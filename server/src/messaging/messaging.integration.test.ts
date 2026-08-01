import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import {
  channelActionTokens,
  channelConnections,
  channelLinkIntents,
  sellers,
} from '../db/schema';
import { decryptString, hashSecret } from '../security/crypto';
import { ChannelActionTokenService } from './actionTokenService';
import { ChannelLinkIntentService } from './linkIntentService';
import { MessagingChannelRegistry } from './registry';
import type { MessagingChannelAdapter } from './types';

const db = createDatabase(env.TEST_DATABASE_URL!);
const sellerIds: string[] = [];
const fakeAdapter = (provider: string): MessagingChannelAdapter => ({
  metadata: { provider, displayName: provider, supportsActions: true, supportsDeepLinks: true },
  createLinkUrl: (token) => `https://${provider}.test/start/${token}`,
  decodeUpdate: () => null,
  send: vi.fn(),
});
const registry = new MessagingChannelRegistry([fakeAdapter('telegram'), fakeAdapter('viber')]);
const links = new ChannelLinkIntentService(
  db.db, registry, env.SESSION_SECRET, env.PII_ENCRYPTION_KEY, 15,
);
const actions = new ChannelActionTokenService(db.db, env.SESSION_SECRET);

async function createSeller() {
  const id = crypto.randomUUID();
  sellerIds.push(id);
  await db.db.insert(sellers).values({
    id, identityProvider: 'messaging-test', providerSubjectHash: crypto.randomUUID(),
    slug: `messages-${crypto.randomUUID()}`, storeName: 'Message store', onboardingCompleted: true,
  });
  return id;
}

describe('messaging links and action tokens', () => {
  beforeAll(async () => migrate(db.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') }));
  afterAll(async () => {
    if (sellerIds.length) {
      await db.db.delete(channelActionTokens).where(inArray(channelActionTokens.sellerId, sellerIds));
      await db.db.delete(channelLinkIntents).where(inArray(channelLinkIntents.targetId, sellerIds));
      await db.db.delete(sellers).where(inArray(sellers.id, sellerIds));
    }
    await db.pool.end();
  });

  it('stores only hashes/encrypted destinations and rejects wrong actor or replay', async () => {
    const sellerId = await createSeller();
    const strangerId = await createSeller();
    const intent = await links.createSellerIntent(sellerId, 'telegram');
    const [stored] = await db.db.select().from(channelLinkIntents).where(eq(channelLinkIntents.id, intent.id));

    expect(stored.browserSecretHash).toBe(hashSecret(intent.browserSecret, env.SESSION_SECRET));
    expect(JSON.stringify(stored)).not.toContain(intent.browserSecret);
    await expect(links.getSellerIntent(strangerId, intent.browserSecret)).rejects.toMatchObject({ code: 'LINK_INTENT_NOT_FOUND' });

    const providerToken = intent.linkUrl.split('/').at(-1)!;
    await links.confirm('telegram', providerToken, 'chat-100');
    const [connection] = await db.db.select().from(channelConnections).where(and(
      eq(channelConnections.sellerId, sellerId), eq(channelConnections.provider, 'telegram'),
    ));
    expect(connection.isPrimary).toBe(true);
    expect(connection.destinationEncrypted).not.toContain('chat-100');
    expect(decryptString(connection.destinationEncrypted, env.PII_ENCRYPTION_KEY)).toBe('chat-100');
    await expect(links.confirm('telegram', providerToken, 'chat-100')).resolves.toMatchObject({ status: 'confirmed' });
    await expect(links.confirm('telegram', providerToken, 'other-chat')).rejects.toMatchObject({ code: 'LINK_INTENT_REPLAYED' });
  });

  it('expires intents and maintains one active primary channel', async () => {
    const sellerId = await createSeller();
    const expired = await links.createSellerIntent(sellerId, 'telegram');
    await db.db.update(channelLinkIntents).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(channelLinkIntents.id, expired.id));
    await expect(links.confirm('telegram', expired.linkUrl.split('/').at(-1)!, 'expired-chat'))
      .rejects.toMatchObject({ code: 'LINK_INTENT_EXPIRED' });

    const telegram = await links.createSellerIntent(sellerId, 'telegram');
    await links.confirm('telegram', telegram.linkUrl.split('/').at(-1)!, 'telegram-chat');
    const viber = await links.createSellerIntent(sellerId, 'viber');
    await links.confirm('viber', viber.linkUrl.split('/').at(-1)!, 'viber-chat');
    await links.setPrimary(sellerId, 'viber');
    const connections = await links.listSellerConnections(sellerId);
    expect(connections.filter((connection) => connection.active && connection.isPrimary)).toEqual([
      expect.objectContaining({ provider: 'viber' }),
    ]);
    await links.disconnect(sellerId, 'viber');
    const afterDisconnect = await links.listSellerConnections(sellerId);
    expect(afterDisconnect.find((item) => item.provider === 'viber'))
      .toMatchObject({ active: false, isPrimary: false });
    expect(afterDisconnect.find((item) => item.provider === 'telegram'))
      .toMatchObject({ active: true, isPrimary: true });
  });

  it('scopes action tokens to the linked destination and makes consumption idempotent', async () => {
    const sellerId = await createSeller();
    const intent = await links.createSellerIntent(sellerId, 'telegram');
    await links.confirm('telegram', intent.linkUrl.split('/').at(-1)!, 'action-chat');
    const [connection] = await db.db.select().from(channelConnections).where(eq(channelConnections.sellerId, sellerId));
    const tokenInput = {
      provider: 'telegram', sellerId, destinationFingerprint: connection.destinationFingerprint,
      aggregateType: 'application', aggregateId: crypto.randomUUID(), action: 'accept_application',
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: `action-test-${crypto.randomUUID()}`,
    };
    const token = await actions.create(tokenInput);
    expect(await actions.create(tokenInput)).toBe(token);

    await expect(actions.consume('telegram', token, 'wrong-chat')).rejects.toMatchObject({ code: 'ACTION_TOKEN_NOT_FOUND' });
    await expect(actions.consume('telegram', token, 'action-chat')).resolves.toMatchObject({ alreadyConsumed: false });
    await expect(actions.consume('telegram', token, 'action-chat')).resolves.toMatchObject({ alreadyConsumed: true });
  });
});
