import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { channelConnections, channelLinkIntents } from '../db/schema';
import { createOpaqueToken } from '../auth/tokens';
import { AppHttpError } from '../http/errors';
import { encryptString, hashSecret } from '../security/crypto';
import type { MessagingChannelRegistry } from './registry';

export class ChannelLinkIntentService {
  constructor(
    private readonly db: Database,
    private readonly registry: MessagingChannelRegistry,
    private readonly secret: string,
    private readonly encryptionKey: string,
    private readonly ttlMinutes: number,
  ) {}

  async createSellerIntent(sellerId: string, provider: string) {
    const adapter = this.registry.get(provider);
    if (!adapter) throw new AppHttpError('Messaging provider is unavailable', 409, 'CHANNEL_UNAVAILABLE');
    const browserSecret = createOpaqueToken();
    const providerToken = createOpaqueToken(18);
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);
    const [intent] = await this.db.insert(channelLinkIntents).values({
      provider,
      targetKind: 'seller',
      targetId: sellerId,
      browserSecretHash: hashSecret(browserSecret, this.secret),
      providerTokenHash: hashSecret(providerToken, this.secret),
      expiresAt,
    }).returning({ id: channelLinkIntents.id });
    return {
      id: intent.id,
      browserSecret,
      provider,
      linkUrl: adapter.createLinkUrl(providerToken),
      expiresAt,
      status: 'pending' as const,
    };
  }

  async getSellerIntent(sellerId: string, browserSecret: string) {
    const [intent] = await this.db.select({
      provider: channelLinkIntents.provider,
      status: channelLinkIntents.status,
      expiresAt: channelLinkIntents.expiresAt,
    }).from(channelLinkIntents).where(and(
      eq(channelLinkIntents.browserSecretHash, hashSecret(browserSecret, this.secret)),
      eq(channelLinkIntents.targetKind, 'seller'),
      eq(channelLinkIntents.targetId, sellerId),
    )).limit(1);
    if (!intent) throw new AppHttpError('Link intent not found', 404, 'LINK_INTENT_NOT_FOUND');
    if (intent.status === 'pending' && intent.expiresAt <= new Date()) {
      await this.db.update(channelLinkIntents).set({ status: 'expired', updatedAt: new Date() }).where(and(
        eq(channelLinkIntents.browserSecretHash, hashSecret(browserSecret, this.secret)),
        eq(channelLinkIntents.status, 'pending'),
      ));
      return { ...intent, status: 'expired' as const };
    }
    return intent;
  }

  async confirm(provider: string, providerToken: string, destination: string) {
    const tokenHash = hashSecret(providerToken, this.secret);
    const destinationFingerprint = hashSecret(`${provider}:${destination}`, this.secret);
    return this.db.transaction(async (transaction) => {
      const [intent] = await transaction.select().from(channelLinkIntents).where(and(
        eq(channelLinkIntents.provider, provider),
        eq(channelLinkIntents.providerTokenHash, tokenHash),
      )).for('update').limit(1);
      if (!intent) throw new AppHttpError('Link intent not found', 404, 'LINK_INTENT_NOT_FOUND');
      if (intent.expiresAt <= new Date()) {
        await transaction.update(channelLinkIntents).set({ status: 'expired', updatedAt: new Date() })
          .where(eq(channelLinkIntents.id, intent.id));
        throw new AppHttpError('Link intent expired', 410, 'LINK_INTENT_EXPIRED');
      }
      if (intent.status === 'confirmed') {
        if (intent.destinationFingerprint !== destinationFingerprint) {
          throw new AppHttpError('Link intent was already confirmed', 409, 'LINK_INTENT_REPLAYED');
        }
        return { status: 'confirmed' as const, targetKind: intent.targetKind };
      }
      if (intent.status !== 'pending') {
        throw new AppHttpError('Link intent is no longer usable', 409, 'LINK_INTENT_REPLAYED');
      }
      const destinationEncrypted = encryptString(destination, this.encryptionKey);
      await transaction.update(channelLinkIntents).set({
        status: 'confirmed',
        confirmedDestinationEncrypted: destinationEncrypted,
        destinationFingerprint,
        updatedAt: new Date(),
      }).where(and(eq(channelLinkIntents.id, intent.id), eq(channelLinkIntents.status, 'pending')));

      if (intent.targetKind === 'seller' && intent.targetId) {
        const [active] = await transaction.select({ id: channelConnections.id })
          .from(channelConnections)
          .where(and(eq(channelConnections.sellerId, intent.targetId), eq(channelConnections.active, true)))
          .limit(1);
        await transaction.insert(channelConnections).values({
          sellerId: intent.targetId,
          provider,
          destinationEncrypted,
          destinationFingerprint,
          active: true,
          isPrimary: !active,
        }).onConflictDoUpdate({
          target: [channelConnections.sellerId, channelConnections.provider],
          set: {
            destinationEncrypted,
            destinationFingerprint,
            active: true,
            isPrimary: !active,
            updatedAt: new Date(),
          },
        });
      }
      return { status: 'confirmed' as const, targetKind: intent.targetKind };
    });
  }

  async listSellerConnections(sellerId: string) {
    return this.db.select({
      id: channelConnections.id,
      provider: channelConnections.provider,
      active: channelConnections.active,
      isPrimary: channelConnections.isPrimary,
      updatedAt: channelConnections.updatedAt,
    }).from(channelConnections).where(eq(channelConnections.sellerId, sellerId));
  }

  async setPrimary(sellerId: string, provider: string) {
    await this.db.transaction(async (transaction) => {
      const [connection] = await transaction.select({ id: channelConnections.id })
        .from(channelConnections).where(and(
          eq(channelConnections.sellerId, sellerId),
          eq(channelConnections.provider, provider),
          eq(channelConnections.active, true),
        )).limit(1);
      if (!connection) throw new AppHttpError('Active channel not found', 404, 'CHANNEL_NOT_FOUND');
      await transaction.update(channelConnections).set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(channelConnections.sellerId, sellerId));
      await transaction.update(channelConnections).set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(channelConnections.id, connection.id));
    });
    return this.listSellerConnections(sellerId);
  }

  async disconnect(sellerId: string, provider: string) {
    await this.db.transaction(async (transaction) => {
      const [connection] = await transaction.select().from(channelConnections).where(and(
        eq(channelConnections.sellerId, sellerId),
        eq(channelConnections.provider, provider),
      )).for('update').limit(1);
      if (!connection) throw new AppHttpError('Channel not found', 404, 'CHANNEL_NOT_FOUND');
      await transaction.update(channelConnections).set({
        active: false, isPrimary: false, updatedAt: new Date(),
      }).where(eq(channelConnections.id, connection.id));
      if (connection.active && connection.isPrimary) {
        const [replacement] = await transaction.select({ id: channelConnections.id })
          .from(channelConnections).where(and(
            eq(channelConnections.sellerId, sellerId),
            eq(channelConnections.active, true),
          )).limit(1);
        if (replacement) await transaction.update(channelConnections)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(channelConnections.id, replacement.id));
      }
    });
  }
}
