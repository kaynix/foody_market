import { createHmac } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { createOpaqueToken } from '../auth/tokens';
import type { Database } from '../db/client';
import { channelActionTokens, channelConnections } from '../db/schema';
import { AppHttpError } from '../http/errors';
import { hashSecret } from '../security/crypto';

export interface CreateActionTokenInput {
  provider: string;
  sellerId: string;
  destinationFingerprint: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  expiresAt: Date;
  idempotencyKey?: string;
}

export class ChannelActionTokenService {
  constructor(private readonly db: Database, private readonly secret: string) {}

  async create(input: CreateActionTokenInput): Promise<string> {
    const idempotencyKey = input.idempotencyKey ?? createOpaqueToken();
    const token = input.idempotencyKey
      ? createHmac('sha256', this.secret).update(`channel-action:${idempotencyKey}`).digest('base64url').slice(0, 24)
      : createOpaqueToken(18);
    await this.db.insert(channelActionTokens).values({
      ...input,
      idempotencyKey,
      tokenHash: hashSecret(token, this.secret),
    }).onConflictDoNothing({ target: channelActionTokens.idempotencyKey });
    return token;
  }

  async consume(provider: string, token: string, destination: string) {
    const tokenHash = hashSecret(token, this.secret);
    const destinationFingerprint = hashSecret(`${provider}:${destination}`, this.secret);
    return this.db.transaction(async (transaction) => {
      const [stored] = await transaction.select().from(channelActionTokens).where(and(
        eq(channelActionTokens.tokenHash, tokenHash),
        eq(channelActionTokens.provider, provider),
        eq(channelActionTokens.destinationFingerprint, destinationFingerprint),
      )).for('update').limit(1);
      if (!stored) throw new AppHttpError('Action token not found', 404, 'ACTION_TOKEN_NOT_FOUND');
      const [connection] = await transaction.select({ id: channelConnections.id })
        .from(channelConnections).where(and(
          eq(channelConnections.sellerId, stored.sellerId),
          eq(channelConnections.provider, provider),
          eq(channelConnections.destinationFingerprint, destinationFingerprint),
          eq(channelConnections.active, true),
        )).limit(1);
      if (!connection) throw new AppHttpError('Channel does not own this action', 403, 'ACTION_ACTOR_INVALID');
      if (stored.expiresAt <= new Date()) {
        throw new AppHttpError('Action token expired', 410, 'ACTION_TOKEN_EXPIRED');
      }
      if (stored.consumedAt) return { ...stored, alreadyConsumed: true };
      const [consumed] = await transaction.update(channelActionTokens)
        .set({ consumedAt: new Date() })
        .where(and(eq(channelActionTokens.id, stored.id), isNull(channelActionTokens.consumedAt)))
        .returning();
      if (!consumed) return { ...stored, alreadyConsumed: true };
      return { ...consumed, alreadyConsumed: false };
    });
  }
}
