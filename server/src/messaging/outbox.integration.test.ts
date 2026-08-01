import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import { outboxAttempts, outboxEvents } from '../db/schema';
import { OutboxWorker } from './outboxWorker';
import { PermanentChannelError } from './types';

const db = createDatabase(env.TEST_DATABASE_URL!);
const eventIds: string[] = [];

async function event(eventType: string, overrides: Partial<typeof outboxEvents.$inferInsert> = {}) {
  const [created] = await db.db.insert(outboxEvents).values({
    aggregateType: 'test', aggregateId: crypto.randomUUID(), eventType,
    idempotencyKey: crypto.randomUUID(), ...overrides,
  }).returning();
  eventIds.push(created.id);
  return created;
}

describe('OutboxWorker', () => {
  beforeAll(async () => migrate(db.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') }));
  afterAll(async () => {
    if (eventIds.length) await db.db.delete(outboxEvents).where(inArray(outboxEvents.id, eventIds));
    await db.pool.end();
  });

  it('retries with backoff and preserves idempotent external delivery', async () => {
    let now = new Date('2026-08-01T12:00:00Z');
    const delivered = new Set<string>();
    const sideEffect = vi.fn();
    const handler = vi.fn(async (_event, idempotencyKey: string) => {
      if (!delivered.has(idempotencyKey)) {
        delivered.add(idempotencyKey);
        sideEffect();
        throw new Error('connection reset after remote accepted the message');
      }
    });
    const created = await event('retry', { availableAt: now });
    const worker = new OutboxWorker(db.db, {
      batchSize: 5, leaseSeconds: 30, maxAttempts: 3, now: () => now, random: () => 0,
    }).register('retry', handler);

    expect(await worker.runBatch()).toBe(1);
    let [stored] = await db.db.select().from(outboxEvents).where(eq(outboxEvents.id, created.id));
    expect(stored).toMatchObject({ state: 'pending', attemptCount: 1 });
    expect(stored.availableAt.getTime()).toBe(now.getTime() + 750);

    now = new Date(stored.availableAt.getTime());
    expect(await worker.runBatch()).toBe(1);
    [stored] = await db.db.select().from(outboxEvents).where(eq(outboxEvents.id, created.id));
    expect(stored).toMatchObject({ state: 'sent', attemptCount: 2 });
    expect(sideEffect).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('recovers an expired lease and records permanent failures', async () => {
    const now = new Date('2026-08-01T13:00:00Z');
    const recoverable = await event('recover', {
      state: 'processing', availableAt: new Date(now.getTime() - 60_000),
      lockedUntil: new Date(now.getTime() - 1000), lockToken: 'dead-worker',
    });
    const permanent = await event('permanent', { availableAt: now });
    const worker = new OutboxWorker(db.db, {
      batchSize: 5, leaseSeconds: 30, maxAttempts: 3, now: () => now,
    })
      .register('recover', vi.fn().mockResolvedValue(undefined))
      .register('permanent', vi.fn().mockRejectedValue(new PermanentChannelError('blocked by user')));

    expect(await worker.runBatch()).toBe(2);
    const [recovered] = await db.db.select().from(outboxEvents).where(eq(outboxEvents.id, recoverable.id));
    const [failed] = await db.db.select().from(outboxEvents).where(eq(outboxEvents.id, permanent.id));
    expect(recovered.state).toBe('sent');
    expect(failed).toMatchObject({ state: 'failed', attemptCount: 1, lastError: 'blocked by user' });
    expect(await db.db.select().from(outboxAttempts).where(eq(outboxAttempts.outboxEventId, permanent.id)))
      .toEqual([expect.objectContaining({ status: 'permanent_failure', attemptNumber: 1 })]);
  });
});
