import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, lte, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import { outboxAttempts, outboxEvents } from '../db/schema';
import { PermanentChannelError } from './types';

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type OutboxHandler = (event: OutboxEvent, idempotencyKey: string) => Promise<void>;

export interface OutboxWorkerOptions {
  batchSize: number;
  leaseSeconds: number;
  maxAttempts: number;
  now?: () => Date;
  random?: () => number;
}

export class OutboxWorker {
  private readonly handlers = new Map<string, OutboxHandler>();
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(private readonly db: Database, private readonly options: OutboxWorkerOptions) {
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  register(eventType: string, handler: OutboxHandler): this {
    this.handlers.set(eventType, handler);
    return this;
  }

  async runBatch(): Promise<number> {
    const now = this.now();
    const lockToken = randomUUID();
    const lockedUntil = new Date(now.getTime() + this.options.leaseSeconds * 1000);
    const claimed = await this.db.transaction(async (transaction) => {
      const candidates = await transaction.select({ id: outboxEvents.id })
        .from(outboxEvents)
        .where(and(
          lte(outboxEvents.availableAt, now),
          or(
            eq(outboxEvents.state, 'pending'),
            and(eq(outboxEvents.state, 'processing'), lte(outboxEvents.lockedUntil, now)),
          ),
        ))
        .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
        .limit(this.options.batchSize)
        .for('update', { skipLocked: true });
      if (!candidates.length) return [];
      return transaction.update(outboxEvents).set({
        state: 'processing', lockedUntil, lockToken, updatedAt: now,
      }).where(inArray(outboxEvents.id, candidates.map((candidate) => candidate.id))).returning();
    });

    for (const event of claimed) await this.deliver(event, lockToken);
    return claimed.length;
  }

  private async deliver(event: OutboxEvent, lockToken: string) {
    const handler = this.handlers.get(event.eventType);
    const attemptNumber = event.attemptCount + 1;
    try {
      if (!handler) throw new PermanentChannelError(`No handler for ${event.eventType}`);
      await handler(event, event.idempotencyKey);
      await this.finish(event.id, lockToken, attemptNumber, 'sent');
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown outbox error';
      const permanent = error instanceof PermanentChannelError || attemptNumber >= this.options.maxAttempts;
      await this.finish(
        event.id,
        lockToken,
        attemptNumber,
        permanent ? 'permanent_failure' : 'retryable_failure',
        message,
      );
    }
  }

  private async finish(
    eventId: string,
    lockToken: string,
    attemptNumber: number,
    status: 'sent' | 'retryable_failure' | 'permanent_failure',
    error?: string,
  ) {
    await this.db.transaction(async (transaction) => {
      const [owned] = await transaction.select({ id: outboxEvents.id })
        .from(outboxEvents).where(and(
          eq(outboxEvents.id, eventId),
          eq(outboxEvents.state, 'processing'),
          eq(outboxEvents.lockToken, lockToken),
        )).for('update').limit(1);
      if (!owned) return;
      await transaction.insert(outboxAttempts).values({
        outboxEventId: eventId,
        attemptNumber,
        status,
        error,
      });
      const now = this.now();
      if (status === 'retryable_failure') {
        const baseDelay = Math.min(15 * 60_000, 1000 * (2 ** Math.min(attemptNumber - 1, 10)));
        const jitteredDelay = Math.round(baseDelay * (0.75 + this.random() * 0.5));
        await transaction.update(outboxEvents).set({
          state: 'pending',
          attemptCount: attemptNumber,
          availableAt: new Date(now.getTime() + jitteredDelay),
          lockedUntil: null,
          lockToken: null,
          lastError: error,
          updatedAt: now,
        }).where(eq(outboxEvents.id, eventId));
      } else {
        await transaction.update(outboxEvents).set({
          state: status === 'sent' ? 'sent' : 'failed',
          attemptCount: attemptNumber,
          lockedUntil: null,
          lockToken: null,
          lastError: error ?? null,
          updatedAt: now,
        }).where(eq(outboxEvents.id, eventId));
      }
    });
  }
}
