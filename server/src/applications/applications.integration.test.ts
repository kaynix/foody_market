import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import {
  auditEvents,
  channelActionTokens,
  channelConnections,
  checkoutGroups,
  deliverySelections,
  outboxEvents,
  sellerApplications,
  sellers,
  applicationItems,
} from '../db/schema';
import { ChannelActionTokenService } from '../messaging/actionTokenService';
import { ChannelLinkIntentService } from '../messaging/linkIntentService';
import { MessagingChannelRegistry } from '../messaging/registry';
import { TelegramChannelAdapter } from '../messaging/telegram';
import { MessagingUpdateService } from '../messaging/updateService';
import { encryptString, hashSecret } from '../security/crypto';
import { ApplicationService } from './service';

const database = createDatabase(env.TEST_DATABASE_URL!);
const service = new ApplicationService(database.db, env.PII_ENCRYPTION_KEY);
const sellerIds: string[] = [];
const groupIds: string[] = [];
const applicationIds: string[] = [];

async function seller(status: 'active' | 'blocked' = 'active') {
  const id = crypto.randomUUID();
  sellerIds.push(id);
  await database.db.insert(sellers).values({
    id, identityProvider: 'application-test', providerSubjectHash: crypto.randomUUID(),
    slug: `application-${crypto.randomUUID()}`, storeName: 'Application store',
    onboardingCompleted: true, status,
  });
  return id;
}

async function application(sellerId: string, status: 'new' | 'accepted' = 'new') {
  const groupId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  groupIds.push(groupId);
  applicationIds.push(applicationId);
  await database.db.insert(checkoutGroups).values({
    id: groupId,
    buyerNameEncrypted: encryptString('Buyer', env.PII_ENCRYPTION_KEY),
    buyerPhoneEncrypted: encryptString('+380501234567', env.PII_ENCRYPTION_KEY),
    buyerChannelProvider: 'telegram',
    buyerChannelDestinationEncrypted: encryptString('buyer-chat', env.PII_ENCRYPTION_KEY),
    buyerChannelFingerprint: crypto.randomUUID(),
    trackingTokenHash: hashSecret(crypto.randomUUID(), env.SESSION_SECRET),
  });
  await database.db.insert(sellerApplications).values({
    id: applicationId, checkoutGroupId: groupId, sellerId, status, amountKopecks: 10_000,
  });
  await database.db.insert(applicationItems).values({
    applicationId, productName: 'Snapshot product', unit: 'piece',
    unitPriceKopecks: 5_000, quantity: 2, lineTotalKopecks: 10_000,
  });
  await database.db.insert(deliverySelections).values({
    applicationId, type: 'pickup',
    detailsEncrypted: encryptString('Tomorrow', env.PII_ENCRYPTION_KEY),
    instructionsSnapshot: 'Call before pickup',
  });
  return { groupId, applicationId };
}

describe('ApplicationService workflow', () => {
  beforeAll(async () => migrate(database.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') }));
  afterAll(async () => {
    if (sellerIds.length) await database.db.delete(channelActionTokens).where(inArray(channelActionTokens.sellerId, sellerIds));
    if (applicationIds.length) {
      await database.db.delete(outboxEvents).where(inArray(outboxEvents.aggregateId, applicationIds));
      await database.db.delete(auditEvents).where(inArray(auditEvents.aggregateId, applicationIds));
      await database.db.delete(sellerApplications).where(inArray(sellerApplications.id, applicationIds));
    }
    if (groupIds.length) await database.db.delete(checkoutGroups).where(inArray(checkoutGroups.id, groupIds));
    if (sellerIds.length) await database.db.delete(sellers).where(inArray(sellers.id, sellerIds));
    await database.pool.end();
  });

  it('enforces the full transition table and keeps duplicate actions idempotent', async () => {
    const owner = await seller();
    const accepted = await application(owner);
    expect(await service.transitionSeller(owner, accepted.applicationId, 'accepted'))
      .toMatchObject({ status: 'accepted', changed: true });
    expect(await service.transitionSeller(owner, accepted.applicationId, 'accepted'))
      .toMatchObject({ status: 'accepted', changed: false });
    expect(await service.transitionSeller(owner, accepted.applicationId, 'completed'))
      .toMatchObject({ status: 'completed', changed: true });
    await expect(service.transitionSeller(owner, accepted.applicationId, 'rejected'))
      .rejects.toMatchObject({ code: 'APPLICATION_TRANSITION_INVALID' });

    const rejected = await application(owner);
    await expect(service.transitionSeller(owner, rejected.applicationId, 'rejected'))
      .resolves.toMatchObject({ status: 'rejected' });
    const cancelled = await application(owner);
    await expect(service.transitionBuyer(cancelled.groupId, cancelled.applicationId))
      .resolves.toMatchObject({ status: 'cancelled' });

    const audits = await database.db.select().from(auditEvents).where(eq(auditEvents.aggregateId, accepted.applicationId));
    expect(audits.map((item) => item.action)).toEqual(['application.accepted', 'application.completed']);
    const events = await database.db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, accepted.applicationId));
    expect(events).toHaveLength(4);
  });

  it('rejects blocked sellers, strangers, and resolves dashboard races once', async () => {
    const owner = await seller();
    const stranger = await seller();
    const blocked = await seller('blocked');
    const owned = await application(owner);
    const blockedApplication = await application(blocked);
    await expect(service.transitionSeller(stranger, owned.applicationId, 'accepted'))
      .rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
    await expect(service.transitionSeller(blocked, blockedApplication.applicationId, 'accepted'))
      .rejects.toMatchObject({ code: 'SELLER_BLOCKED' });

    const outcomes = await Promise.allSettled([
      service.transitionSeller(owner, owned.applicationId, 'accepted'),
      service.transitionSeller(owner, owned.applicationId, 'rejected'),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await database.db.select().from(auditEvents).where(eq(auditEvents.aggregateId, owned.applicationId)))
      .toHaveLength(1);
  });

  it('executes Telegram callbacks through the same service and handles duplicate clicks', async () => {
    const owner = await seller();
    const created = await application(owner);
    const sendMessage = vi.fn().mockResolvedValue({});
    const answerCallbackQuery = vi.fn().mockResolvedValue(true);
    const adapter = new TelegramChannelAdapter('token', 'test_bot', { sendMessage, answerCallbackQuery });
    const registry = new MessagingChannelRegistry([adapter]);
    const actions = new ChannelActionTokenService(database.db, env.SESSION_SECRET);
    await database.db.insert(channelConnections).values({
      sellerId: owner, provider: 'telegram',
      destinationEncrypted: encryptString('seller-chat', env.PII_ENCRYPTION_KEY),
      destinationFingerprint: hashSecret('telegram:seller-chat', env.SESSION_SECRET),
      active: true, isPrimary: true,
    });
    const token = await actions.create({
      provider: 'telegram', sellerId: owner,
      destinationFingerprint: hashSecret('telegram:seller-chat', env.SESSION_SECRET),
      aggregateType: 'application', aggregateId: created.applicationId,
      action: 'accept_application', expiresAt: new Date(Date.now() + 60_000),
    });
    const updates = new MessagingUpdateService(
      registry,
      new ChannelLinkIntentService(database.db, registry, env.SESSION_SECRET, env.PII_ENCRYPTION_KEY, 15),
      actions,
      service,
    );
    const update = {
      callback_query: {
        id: 'callback', data: `act:${token}`, message: { chat: { id: 'seller-chat' } },
      },
    };
    await expect(updates.handle('telegram', update)).resolves.toMatchObject({
      valid: true, result: { status: 'accepted', changed: true },
    });
    await expect(updates.handle('telegram', update)).resolves.toMatchObject({
      valid: true, result: { status: 'accepted', changed: false },
    });
    expect(answerCallbackQuery).toHaveBeenCalledTimes(2);
    expect(await database.db.select().from(auditEvents).where(and(
      eq(auditEvents.aggregateId, created.applicationId),
      eq(auditEvents.action, 'application.accepted'),
    ))).toHaveLength(1);
  });
});
