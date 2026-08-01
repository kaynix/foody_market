import path from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import {
  channelActionTokens,
  channelLinkIntents,
  checkoutGroups,
  sellers,
  workerHeartbeats,
} from '../db/schema';
import { encryptString } from '../security/crypto';
import { CleanupService } from './cleanupService';
import { HeartbeatService } from './heartbeatService';

const database = createDatabase(env.TEST_DATABASE_URL!);
const sellerId = crypto.randomUUID();
const groupId = crypto.randomUUID();
const provider = `maintenance-${crypto.randomUUID()}`;

describe('marketplace maintenance', () => {
  beforeAll(async () => {
    await migrate(database.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    await database.db.insert(sellers).values({
      id: sellerId,
      identityProvider: provider,
      providerSubjectHash: crypto.randomUUID(),
      slug: `maintenance-${crypto.randomUUID()}`,
      storeName: 'Maintenance seller',
    });
  });

  afterAll(async () => {
    await database.db.delete(channelActionTokens).where(eq(channelActionTokens.sellerId, sellerId));
    await database.db.delete(channelLinkIntents).where(eq(channelLinkIntents.provider, provider));
    await database.db.delete(checkoutGroups).where(eq(checkoutGroups.id, groupId));
    await database.db.delete(workerHeartbeats).where(eq(workerHeartbeats.workerName, provider));
    await database.db.delete(sellers).where(eq(sellers.id, sellerId));
    await database.pool.end();
  });

  it('expires old transient credentials while preserving checkout audit data', async () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    await database.db.insert(channelLinkIntents).values({
      provider,
      targetKind: 'buyer',
      browserSecretHash: crypto.randomUUID(),
      providerTokenHash: crypto.randomUUID(),
      status: 'expired',
      expiresAt: new Date('2026-07-29T12:00:00.000Z'),
    });
    await database.db.insert(channelActionTokens).values({
      tokenHash: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      provider,
      sellerId,
      destinationFingerprint: crypto.randomUUID(),
      aggregateType: 'application',
      aggregateId: crypto.randomUUID(),
      action: 'accept',
      expiresAt: new Date('2026-07-20T12:00:00.000Z'),
    });
    await database.db.insert(checkoutGroups).values({
      id: groupId,
      buyerNameEncrypted: encryptString('Maintenance buyer', env.PII_ENCRYPTION_KEY),
      buyerPhoneEncrypted: encryptString('+380000000000', env.PII_ENCRYPTION_KEY),
      buyerChannelProvider: provider,
      buyerChannelDestinationEncrypted: encryptString('destination', env.PII_ENCRYPTION_KEY),
      buyerChannelFingerprint: crypto.randomUUID(),
      trackingTokenHash: crypto.randomUUID(),
      trackingExpiresAt: new Date('2026-07-31T12:00:00.000Z'),
    });

    const result = await new CleanupService(database.db, {
      sessionDays: 7,
      linkIntentHours: 24,
      actionTokenDays: 7,
    }).run(now);

    expect(result).toMatchObject({ linkIntents: 1, actionTokens: 1, trackingCredentials: 1 });
    const [group] = await database.db.select().from(checkoutGroups).where(eq(checkoutGroups.id, groupId));
    expect(group.trackingRevokedAt).toEqual(now);
    expect(group.trackingTokenHash).toBe(`expired:${groupId}`);
  });

  it('publishes worker heartbeats for readiness diagnostics', async () => {
    const heartbeat = new HeartbeatService(database.db, provider);
    await heartbeat.beat({ processed: 3 }, true);

    const rows = await HeartbeatService.list(database.db);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ workerName: provider, metadata: { processed: 3 } }),
    ]));
  });
});
