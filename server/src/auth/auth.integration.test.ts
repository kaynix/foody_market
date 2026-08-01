import path from 'node:path';
import express from 'express';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app';
import { database } from '../db/client';
import { sellerSessions, sellers } from '../db/schema';
import { requireSellerOwnership } from './middleware';

async function startAndComplete(agent: ReturnType<typeof request.agent>, accountId = 'new-seller') {
  const start = await agent.post('/api/auth/development/start').expect(200);
  const callback = await agent
    .post('/api/auth/development/callback')
    .send({ state: start.body.state, accountId })
    .expect(200);
  const cookies = callback.headers['set-cookie'] as unknown as string[];
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('hutorynok_seller_session='));
  if (!sessionCookie) throw new Error('Session cookie was not set');

  return {
    seller: callback.body.seller as { id: string; status: string },
    csrfToken: callback.body.csrfToken as string,
    sessionCookie,
    rawSessionToken: sessionCookie.split(';', 1)[0].split('=', 2)[1],
  };
}

describe('seller authentication HTTP flow', () => {
  beforeAll(async () => {
    await migrate(database.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  });

  beforeEach(async () => {
    await database.db.delete(sellers).where(eq(sellers.identityProvider, 'development'));
  });

  afterAll(async () => {
    await database.db.delete(sellers).where(eq(sellers.identityProvider, 'development'));
    await database.pool.end();
  });

  it('reports liveness and database-backed readiness independently of Telegram', async () => {
    const health = await request(app).get('/health').expect(200);
    expect(health.body).toMatchObject({ status: 'ok', service: 'hutorynok-api' });

    const readiness = await request(app).get('/ready').expect(200);
    expect(readiness.body).toMatchObject({
      status: 'ready',
      dependencies: {
        postgresql: 'ready',
        storage: { status: 'configured', driver: 'local' },
      },
    });
    expect(readiness.body.note).toContain('does not gate API readiness');
  });

  it('advertises development identity and keeps the unconfigured Diia slot unavailable', async () => {
    const response = await request(app).get('/api/auth/providers').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['ratelimit-policy']).toBeDefined();

    expect(response.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'development', available: true }),
        expect.objectContaining({ name: 'diia', available: false }),
      ]),
    );
  });

  it('creates a seller session and restores it from an httpOnly cookie', async () => {
    const agent = request.agent(app);
    const login = await startAndComplete(agent);

    const session = await agent.get('/api/auth/session').expect(200);
    expect(session.body.seller.id).toBe(login.seller.id);

    const rows = await database.db
      .select({ tokenHash: sellerSessions.tokenHash })
      .from(sellerSessions)
      .where(eq(sellerSessions.sellerId, login.seller.id));
    expect(rows).toHaveLength(1);
    expect(login.sessionCookie).toContain('HttpOnly');
    expect(login.sessionCookie).toContain('SameSite=Lax');
    expect(rows[0].tokenHash).not.toBe(login.rawSessionToken);
  });

  it('rejects a callback whose state is not bound to the browser cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/development/start').expect(200);

    const response = await agent
      .post('/api/auth/development/callback')
      .send({ state: 'forged-state', accountId: 'new-seller' })
      .expect(403);

    expect(response.body.code).toBe('IDENTITY_STATE_INVALID');
  });

  it('requires CSRF for logout and revokes the session after a valid request', async () => {
    const agent = request.agent(app);
    const login = await startAndComplete(agent);

    await agent.post('/api/auth/logout').expect(403);
    await agent.post('/api/auth/logout').set('x-csrf-token', login.csrfToken).expect(204);
    await agent.get('/api/auth/session').expect(401);
  });

  it('rotates the previous session when the seller signs in again', async () => {
    const agent = request.agent(app);
    const first = await startAndComplete(agent);
    await startAndComplete(agent);

    const sessions = await database.db
      .select({ revokedAt: sellerSessions.revokedAt })
      .from(sellerSessions)
      .where(eq(sellerSessions.sellerId, first.seller.id));

    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.revokedAt === null)).toHaveLength(1);
  });

  it('rejects expired and blocked seller sessions', async () => {
    const expiredAgent = request.agent(app);
    const expired = await startAndComplete(expiredAgent);
    await database.db
      .update(sellerSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sellerSessions.sellerId, expired.seller.id));
    await expiredAgent.get('/api/auth/session').expect(401);

    await database.db.delete(sellers).where(eq(sellers.id, expired.seller.id));

    const blockedAgent = request.agent(app);
    const blocked = await startAndComplete(blockedAgent);
    await database.db
      .update(sellers)
      .set({ status: 'blocked' })
      .where(eq(sellers.id, blocked.seller.id));
    await blockedAgent.get('/api/auth/session').expect(401);
  });
});

describe('seller ownership middleware', () => {
  it('allows only the authenticated seller ID', async () => {
    const ownSellerId = crypto.randomUUID();
    const ownershipApp = express();
    ownershipApp.use((req, _res, next) => {
      req.seller = {
        id: ownSellerId,
        status: 'active',
        slug: 'owner',
        storeName: 'Owner',
        onboardingCompleted: false,
      };
      next();
    });
    ownershipApp.get('/sellers/:sellerId', requireSellerOwnership(), (_req, res) => {
      res.status(204).send();
    });
    ownershipApp.use((error: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(error.statusCode ?? 500).send();
    });

    await request(ownershipApp).get(`/sellers/${ownSellerId}`).expect(204);
    await request(ownershipApp).get(`/sellers/${crypto.randomUUID()}`).expect(403);
  });
});
