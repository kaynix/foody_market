import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import {
  applicationItems,
  auditEvents,
  categories,
  channelLinkIntents,
  checkoutGroups,
  outboxEvents,
  products,
  sellerApplications,
  sellerDeliveryOptions,
  sellerPublicContacts,
  sellers,
  channelConnections,
} from '../db/schema';
import { ChannelLinkIntentService } from '../messaging/linkIntentService';
import { MessagingChannelRegistry } from '../messaging/registry';
import type { MessagingChannelAdapter } from '../messaging/types';
import { CheckoutService } from './service';
import { ApplicationService } from '../applications/service';

const database = createDatabase(env.TEST_DATABASE_URL!);
const provider = `checkout-test-${crypto.randomUUID()}`;
const adapter: MessagingChannelAdapter = {
  metadata: { provider, displayName: 'Checkout test', supportsActions: true, supportsDeepLinks: true },
  createLinkUrl: (token) => `https://messenger.test/${token}`,
  decodeUpdate: () => null,
  send: vi.fn(),
};
const links = new ChannelLinkIntentService(
  database.db, new MessagingChannelRegistry([adapter]),
  env.SESSION_SECRET, env.PII_ENCRYPTION_KEY, 15,
);
const applications = new ApplicationService(database.db, env.PII_ENCRYPTION_KEY);
const service = new CheckoutService(
  database.db, links, env.SESSION_SECRET, env.PII_ENCRYPTION_KEY, applications,
);
const sellerIds: string[] = [];
const productIds: string[] = [];
const groupIds: string[] = [];
const categoryId = 8_800_002;

async function setupSeller(label: string, priceKopecks: number) {
  const sellerId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  sellerIds.push(sellerId);
  productIds.push(productId);
  await database.db.insert(sellers).values({
    id: sellerId, identityProvider: 'checkout-test', providerSubjectHash: crypto.randomUUID(),
    slug: `${label}-${crypto.randomUUID()}`, storeName: `Store ${label}`, onboardingCompleted: true,
  });
  await database.db.insert(sellerPublicContacts).values({
    sellerId, type: 'phone', label: 'Телефон', value: '+380501234567', sortOrder: 0,
  });
  await database.db.insert(sellerDeliveryOptions).values({
    sellerId, type: 'pickup', instructions: `Pickup from ${label}`, active: true,
  });
  await database.db.insert(channelConnections).values({
    sellerId, provider, destinationEncrypted: 'encrypted',
    destinationFingerprint: crypto.randomUUID(), active: true, isPrimary: true,
  });
  await database.db.insert(products).values({
    id: productId, sellerId, categoryId, name: `Product ${label}`,
    description: 'Checkout product', priceKopecks, unit: 'piece', minimumQuantity: 1,
  });
  return { sellerId, productId };
}

async function confirmedBuyerIntent(destination = crypto.randomUUID()) {
  const intent = await links.createBuyerIntent(provider);
  await links.confirm(provider, intent.linkUrl.split('/').at(-1)!, destination);
  return intent;
}

describe('grouped checkout and tracking', () => {
  beforeAll(async () => {
    await migrate(database.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    await database.db.insert(categories).values({
      id: categoryId, name: 'Checkout test', slug: `checkout-${crypto.randomUUID()}`,
    });
  });

  afterAll(async () => {
    if (groupIds.length) {
      const applications = await database.db.select({ id: sellerApplications.id })
        .from(sellerApplications).where(inArray(sellerApplications.checkoutGroupId, groupIds));
      const applicationIds = applications.map((item) => item.id);
      if (applicationIds.length) {
        await database.db.delete(outboxEvents).where(inArray(outboxEvents.aggregateId, applicationIds));
        await database.db.delete(auditEvents).where(inArray(auditEvents.aggregateId, applicationIds));
      }
      await database.db.delete(outboxEvents).where(inArray(outboxEvents.aggregateId, groupIds));
      await database.db.delete(auditEvents).where(inArray(auditEvents.aggregateId, groupIds));
      await database.db.delete(sellerApplications).where(inArray(sellerApplications.checkoutGroupId, groupIds));
      await database.db.delete(checkoutGroups).where(inArray(checkoutGroups.id, groupIds));
    }
    await database.db.delete(channelLinkIntents).where(eq(channelLinkIntents.provider, provider));
    if (productIds.length) await database.db.delete(products).where(inArray(products.id, productIds));
    if (sellerIds.length) await database.db.delete(sellers).where(inArray(sellers.id, sellerIds));
    await database.db.delete(categories).where(eq(categories.id, categoryId));
    await database.pool.end();
  });

  it('creates one application per seller and immutable server-authoritative snapshots', async () => {
    const first = await setupSeller('first', 12_300);
    const second = await setupSeller('second', 7_700);
    const secondProductSameSeller = crypto.randomUUID();
    productIds.push(secondProductSameSeller);
    await database.db.insert(products).values({
      id: secondProductSameSeller, sellerId: first.sellerId, categoryId,
      name: 'Second first-store product', description: 'Another product',
      priceKopecks: 2_500, unit: 'box', minimumQuantity: 1,
    });
    const buyerIntent = await confirmedBuyerIntent('buyer-chat');
    const lines = [
      { productId: first.productId, quantity: 1 },
      { productId: first.productId, quantity: 2 },
      { productId: secondProductSameSeller, quantity: 1 },
      { productId: second.productId, quantity: 2 },
    ];

    const validation = await service.validate(lines);
    expect(validation.valid).toBe(true);
    expect(validation.groups).toHaveLength(2);
    expect(validation.groups.find((group) => group.seller.id === first.sellerId)?.items
      .find((item) => item.productId === first.productId)?.quantity).toBe(3);

    const created = await service.create({
      lines: lines.map((line) => ({
        ...line,
        expectedPriceKopecks: line.productId === first.productId
          ? 12_300
          : line.productId === secondProductSameSeller ? 2_500 : 7_700,
      })),
      buyer: { name: 'Покупець', phone: '+380671234567' },
      channel: { provider, browserSecret: buyerIntent.browserSecret },
      deliveries: [
        { sellerId: first.sellerId, type: 'pickup', details: 'Saturday morning' },
        { sellerId: second.sellerId, type: 'pickup', details: 'Sunday morning' },
      ],
    });
    groupIds.push(created.groupId);
    expect(created.applicationIds).toHaveLength(2);
    expect(new Set(created.acceptedProductIds)).toEqual(new Set([
      first.productId, secondProductSameSeller, second.productId,
    ]));
    const applications = await database.db.select().from(sellerApplications)
      .where(eq(sellerApplications.checkoutGroupId, created.groupId));
    expect(applications).toHaveLength(2);
    const firstApplication = applications.find((item) => item.sellerId === first.sellerId)!;
    expect(firstApplication.amountKopecks).toBe(39_400);
    const snapshots = await database.db.select().from(applicationItems)
      .where(eq(applicationItems.applicationId, firstApplication.id));
    expect(snapshots.find((item) => item.productId === first.productId)).toMatchObject({
      unitPriceKopecks: 12_300, quantity: 3, lineTotalKopecks: 36_900,
    });

    await database.db.update(products).set({ priceKopecks: 99_999 }).where(eq(products.id, first.productId));
    await expect(service.getTracking(created.groupId, 'wrong-token')).rejects.toMatchObject({ code: 'TRACKING_NOT_FOUND' });
    const tracking = await service.getTracking(created.groupId, created.trackingToken);
    expect(JSON.stringify(tracking)).not.toContain('buyer-chat');
    expect(JSON.stringify(tracking)).not.toContain('+380671234567');
    expect(tracking.applications.find((item) => item.id === firstApplication.id)?.items
      .find((item) => item.productId === first.productId)?.unitPriceKopecks)
      .toBe(12_300);

    await expect(service.create({
      lines: [{ productId: second.productId, quantity: 1, expectedPriceKopecks: 7_700 }],
      buyer: { name: 'Replay', phone: '+380671234567' },
      channel: { provider, browserSecret: buyerIntent.browserSecret },
      deliveries: [{ sellerId: second.sellerId, type: 'pickup', details: 'Replay' }],
    })).rejects.toMatchObject({ code: 'BUYER_CHANNEL_UNCONFIRMED' });

    await expect(service.cancel(created.groupId, firstApplication.id, created.trackingToken))
      .resolves.toMatchObject({ status: 'cancelled' });
    await expect(service.cancel(created.groupId, firstApplication.id, created.trackingToken))
      .resolves.toMatchObject({ status: 'cancelled' });
  });

  it('rejects the whole checkout when delivery, product, or seller eligibility is invalid', async () => {
    const seller = await setupSeller('rollback', 5_000);
    const intent = await confirmedBuyerIntent();
    const before = await database.db.select({ id: checkoutGroups.id }).from(checkoutGroups);
    await expect(service.create({
      lines: [{ productId: seller.productId, quantity: 1, expectedPriceKopecks: 5_000 }],
      buyer: { name: 'Покупець', phone: '+380501112233' },
      channel: { provider, browserSecret: intent.browserSecret },
      deliveries: [{ sellerId: seller.sellerId, type: 'nova_poshta', details: 'Branch 1' }],
    })).rejects.toMatchObject({ code: 'CHECKOUT_INVALID' });
    const after = await database.db.select({ id: checkoutGroups.id }).from(checkoutGroups);
    expect(after).toHaveLength(before.length);
    expect((await links.getBuyerIntent(intent.browserSecret)).status).toBe('confirmed');

    await database.db.update(products).set({ priceKopecks: 6_000 }).where(eq(products.id, seller.productId));
    await expect(service.create({
      lines: [{ productId: seller.productId, quantity: 1, expectedPriceKopecks: 5_000 }],
      buyer: { name: 'Покупець', phone: '+380501112233' },
      channel: { provider, browserSecret: intent.browserSecret },
      deliveries: [{ sellerId: seller.sellerId, type: 'pickup', details: 'Tomorrow' }],
    })).rejects.toMatchObject({
      code: 'CHECKOUT_INVALID',
      details: { errors: expect.arrayContaining([expect.objectContaining({ code: 'PRICE_CHANGED' })]) },
    });

    await database.db.update(products).set({ state: 'hidden' }).where(eq(products.id, seller.productId));
    expect((await service.validate([{ productId: seller.productId, quantity: 1 }])).errors)
      .toContainEqual(expect.objectContaining({ code: 'PRODUCT_UNAVAILABLE' }));
    await database.db.update(products).set({ state: 'available' }).where(eq(products.id, seller.productId));
    await database.db.update(channelConnections).set({ active: false, isPrimary: false })
      .where(eq(channelConnections.sellerId, seller.sellerId));
    expect((await service.validate([{ productId: seller.productId, quantity: 1 }])).errors)
      .toContainEqual(expect.objectContaining({ code: 'SELLER_UNAVAILABLE' }));
  });
});
