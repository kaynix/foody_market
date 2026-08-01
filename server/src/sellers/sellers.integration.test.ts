import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CSRF_COOKIE, SESSION_COOKIE } from '../auth/middleware';
import { SellerSessionService } from '../auth/sessionService';
import { createSignedToken } from '../auth/tokens';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import { sellerPublicContacts, sellers } from '../db/schema';
import { errorHandler } from '../middleware/errorHandler';
import { createSellerRouter, createStorefrontRouter } from './routes';
import { SellerProfileService } from './service';
import { StorefrontService } from './storefrontService';
import type { FileStorageAdapter } from '../storage/types';

const testDatabase = createDatabase(env.TEST_DATABASE_URL!);
const sessionService = new SellerSessionService(testDatabase.db, {
  secret: env.SESSION_SECRET,
  ttlHours: 1,
});
const profileService = new SellerProfileService(testDatabase.db);
const testStorage: FileStorageAdapter = {
  async put() {},
  async delete() {},
  getPublicUrl: (key) => `http://storage.test/${key}`,
};
const storefrontService = new StorefrontService(
  testDatabase.db,
  testStorage,
  'http://localhost:3001',
);
const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use(
  '/api/seller',
  createSellerRouter({ config: env, sessionService, profileService }),
);
testApp.use('/api/storefronts', createStorefrontRouter(storefrontService));
testApp.use(errorHandler);

interface SellerAccess {
  sellerId: string;
  cookie: string;
  csrf: string;
}

async function createSellerAccess(): Promise<SellerAccess> {
  const session = await sessionService.create({
    provider: 'development',
    subject: `profile-test-${crypto.randomUUID()}`,
    verifiedAt: new Date(),
  });
  const csrf = createSignedToken(env.SESSION_SECRET, session.expiresAt);
  return {
    sellerId: session.seller.id,
    csrf,
    cookie: `${SESSION_COOKIE}=${session.rawToken}; ${CSRF_COOKIE}=${csrf}`,
  };
}

function authorized(access: SellerAccess) {
  return {
    get: (url: string) => request(testApp).get(url).set('Cookie', access.cookie),
    post: (url: string) => request(testApp).post(url).set('Cookie', access.cookie).set('x-csrf-token', access.csrf),
    put: (url: string) => request(testApp).put(url).set('Cookie', access.cookie).set('x-csrf-token', access.csrf),
    patch: (url: string) => request(testApp).patch(url).set('Cookie', access.cookie).set('x-csrf-token', access.csrf),
    delete: (url: string) => request(testApp).delete(url).set('Cookie', access.cookie).set('x-csrf-token', access.csrf),
  };
}

function onboardingPayload(slug: string) {
  return {
    profile: {
      slug,
      storeName: 'Сімейна пасіка',
      description: 'Мед і віск від родини виробників.',
      region: 'Полтавська область',
    },
    contacts: [
      { type: 'phone', label: 'Телефон', value: '+380501234567', sortOrder: 0 },
    ],
    deliveryOptions: [
      { type: 'nova_poshta', instructions: 'Вкажіть місто та відділення.', active: true },
    ],
  };
}

describe('seller profile API', () => {
  beforeAll(async () => {
    await migrate(testDatabase.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  });

  afterAll(async () => {
    await testDatabase.db
      .delete(sellers)
      .where(eq(sellers.identityProvider, 'development'));
    await testDatabase.pool.end();
  });

  it('completes onboarding atomically and exposes only public storefront fields', async () => {
    const access = await createSellerAccess();
    const api = authorized(access);

    const completed = await api.put('/api/seller/onboarding').send(onboardingPayload('Family_Honey')).expect(200);
    expect(completed.body.profile).toMatchObject({
      slug: 'family-honey',
      storeName: 'Сімейна пасіка',
      onboardingCompleted: true,
    });

    const storefront = await request(testApp).get('/api/storefronts/family-honey').expect(200);
    expect(storefront.body).toEqual({
      store: {
        id: access.sellerId,
        slug: 'family-honey',
        storeName: 'Сімейна пасіка',
        description: 'Мед і віск від родини виробників.',
        region: 'Полтавська область',
      },
      contacts: [expect.objectContaining({ type: 'phone', value: '+380501234567' })],
      deliveryOptions: [
        expect.objectContaining({ type: 'nova_poshta', instructions: 'Вкажіть місто та відділення.' }),
      ],
      products: [],
    });
    const serialized = JSON.stringify(storefront.body);
    expect(serialized).not.toContain('providerSubject');
    expect(serialized).not.toContain('identityProvider');
    expect(serialized).not.toContain('session');
    expect(serialized).not.toContain('destinationEncrypted');
  });

  it('does not partially update onboarding when the required contact is missing', async () => {
    const access = await createSellerAccess();
    const invalidPayload = { ...onboardingPayload('invalid-onboarding'), contacts: [] };

    await authorized(access).put('/api/seller/onboarding').send(invalidPayload).expect(400);

    const stored = await profileService.getPrivateProfile(access.sellerId);
    expect(stored.profile.onboardingCompleted).toBe(false);
    expect(stored.profile.slug).not.toBe('invalid-onboarding');
    expect(stored.contacts).toHaveLength(0);
  });

  it('returns a conflict for an already used normalized slug', async () => {
    const first = await createSellerAccess();
    const second = await createSellerAccess();
    await authorized(first).put('/api/seller/onboarding').send(onboardingPayload('unique-farm')).expect(200);

    const conflict = await authorized(second)
      .put('/api/seller/onboarding')
      .send(onboardingPayload('UNIQUE_FARM'))
      .expect(409);
    expect(conflict.body.code).toBe('SLUG_CONFLICT');
  });

  it('cannot mutate another seller contact and downgrades onboarding after deleting the last own contact', async () => {
    const owner = await createSellerAccess();
    const stranger = await createSellerAccess();
    await authorized(owner).put('/api/seller/onboarding').send(onboardingPayload(`owner-${owner.sellerId.slice(0, 8)}`)).expect(200);
    const [contact] = await testDatabase.db
      .select()
      .from(sellerPublicContacts)
      .where(eq(sellerPublicContacts.sellerId, owner.sellerId));

    await authorized(stranger).delete(`/api/seller/contacts/${contact.id}`).expect(404);
    await authorized(owner).delete(`/api/seller/contacts/${contact.id}`).expect(204);

    const stored = await profileService.getPrivateProfile(owner.sellerId);
    expect(stored.profile.onboardingCompleted).toBe(false);
    expect(stored.contacts).toHaveLength(0);
  });

  it('rejects unsafe contact URLs through the authenticated CRUD endpoint', async () => {
    const access = await createSellerAccess();
    const response = await authorized(access).post('/api/seller/contacts').send({
      type: 'website',
      label: 'Небезпечний сайт',
      value: 'javascript:alert(1)',
      sortOrder: 0,
    }).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
