import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { encryptString, hashSecret } from '../security/crypto';
import { categories, checkoutGroups, products, sellers } from './schema';

const pool = new Pool({ connectionString: env.TEST_DATABASE_URL });
const db = drizzle(pool);

describe('marketplace database schema', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates the core marketplace tables', async () => {
    const result = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in (
           'sellers', 'products', 'checkout_groups',
           'seller_applications', 'outbox_events'
         )
       order by table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'checkout_groups',
      'outbox_events',
      'products',
      'seller_applications',
      'sellers',
    ]);
  });

  it('enforces nonnegative product prices', async () => {
    const sellerId = randomUUID();
    const categoryId = 9_000_000 + Math.floor(Math.random() * 999_999);

    await db.insert(sellers).values({
      id: sellerId,
      identityProvider: 'test',
      providerSubjectHash: randomUUID(),
      slug: `schema-test-${sellerId}`,
      storeName: 'Schema test seller',
    });
    await db.insert(categories).values({
      id: categoryId,
      name: 'Schema test',
      slug: `test-${sellerId}`,
    });

    await expect(
      db.insert(products).values({
        sellerId,
        categoryId,
        name: 'Invalid product',
        description: 'Must fail',
        priceKopecks: -1,
        unit: 'piece',
      }),
    ).rejects.toThrow();

    await db.delete(categories).where(sql`${categories.id} = ${categoryId}`);
    await db.delete(sellers).where(sql`${sellers.id} = ${sellerId}`);
  });

  it('rolls back all writes when a transaction fails', async () => {
    const sellerId = randomUUID();

    await expect(
      db.transaction(async (transaction) => {
        await transaction.insert(sellers).values({
          id: sellerId,
          identityProvider: 'test',
          providerSubjectHash: randomUUID(),
          slug: `rollback-${sellerId}`,
          storeName: 'Must be rolled back',
        });
        throw new Error('rollback requested');
      }),
    ).rejects.toThrow('rollback requested');

    const rows = await db.select().from(sellers).where(eq(sellers.id, sellerId));
    expect(rows).toHaveLength(0);
  });

  it('stores buyer PII encrypted rather than as plaintext', async () => {
    const groupId = randomUUID();
    const buyerName = 'Database privacy test';
    const buyerPhone = '+380501234567';
    const destination = 'telegram-chat-123';

    await db.insert(checkoutGroups).values({
      id: groupId,
      buyerNameEncrypted: encryptString(buyerName, env.PII_ENCRYPTION_KEY),
      buyerPhoneEncrypted: encryptString(buyerPhone, env.PII_ENCRYPTION_KEY),
      buyerChannelProvider: 'telegram',
      buyerChannelDestinationEncrypted: encryptString(destination, env.PII_ENCRYPTION_KEY),
      buyerChannelFingerprint: hashSecret(destination, env.SESSION_SECRET),
      trackingTokenHash: hashSecret(randomUUID(), env.SESSION_SECRET),
    });

    const rawRow = await pool.query<Record<string, string>>(
      'select * from checkout_groups where id = $1',
      [groupId],
    );
    const serialized = JSON.stringify(rawRow.rows[0]);

    expect(serialized).not.toContain(buyerName);
    expect(serialized).not.toContain(buyerPhone);
    expect(serialized).not.toContain(destination);

    await db.delete(checkoutGroups).where(eq(checkoutGroups.id, groupId));
  });
});
