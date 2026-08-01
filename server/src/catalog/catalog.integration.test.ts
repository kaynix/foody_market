import path from 'node:path';
import sharp from 'sharp';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { createDatabase } from '../db/client';
import {
  auditEvents,
  categories,
  channelConnections,
  outboxEvents,
  productImages,
  products,
  sellers,
} from '../db/schema';
import { ProductImageProcessor, type ProcessedProductImage } from '../storage/images';
import type { FileStorageAdapter, StoredObjectInput } from '../storage/types';
import { CatalogService } from './catalogService';
import { SellerProductService } from './sellerProductService';

class MemoryStorage implements FileStorageAdapter {
  readonly objects = new Map<string, Buffer>();
  async put(input: StoredObjectInput) { this.objects.set(input.key, input.data); }
  async delete(key: string) { this.objects.delete(key); }
  getPublicUrl(key: string) { return `http://storage.test/${key}`; }
}

const testDatabase = createDatabase(env.TEST_DATABASE_URL!);
const storage = new MemoryStorage();
const processor = new ProductImageProcessor(storage);
const catalog = new CatalogService(testDatabase.db, storage, 'http://localhost:3001');
const sellerProducts = new SellerProductService(
  testDatabase.db,
  storage,
  processor,
  'http://localhost:3001',
);
const sellerIds: string[] = [];
const productIds: string[] = [];
const categoryId = 8_700_001;

async function createSeller(slug: string) {
  const id = crypto.randomUUID();
  sellerIds.push(id);
  await testDatabase.db.insert(sellers).values({
    id,
    identityProvider: 'catalog-test',
    providerSubjectHash: crypto.randomUUID(),
    slug,
    storeName: `Store ${slug}`,
    onboardingCompleted: true,
  });
  return id;
}

async function testPng() {
  return sharp({
    create: { width: 640, height: 480, channels: 3, background: '#f4b942' },
  }).png().toBuffer();
}

const productInput = {
  categoryId,
  name: 'Golden honey',
  description: 'Fresh honey from a family apiary',
  priceKopecks: 12_345,
  unit: 'jar',
  minimumQuantity: 1,
};

describe('PostgreSQL catalog and seller product service', () => {
  beforeAll(async () => {
    await migrate(testDatabase.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    await testDatabase.db
      .insert(categories)
      .values({ id: categoryId, name: 'Catalog test', slug: `catalog-test-${crypto.randomUUID()}` });
  });

  afterAll(async () => {
    if (productIds.length) {
      await testDatabase.db.delete(outboxEvents).where(inArray(outboxEvents.aggregateId, productIds));
      await testDatabase.db.delete(auditEvents).where(inArray(auditEvents.aggregateId, productIds));
    }
    if (sellerIds.length) {
      await testDatabase.db.delete(auditEvents).where(inArray(auditEvents.actorId, sellerIds));
      await testDatabase.db.delete(products).where(inArray(products.sellerId, sellerIds));
      await testDatabase.db.delete(sellers).where(inArray(sellers.id, sellerIds));
    }
    await testDatabase.db.delete(categories).where(eq(categories.id, categoryId));
    await testDatabase.pool.end();
  });

  it('publishes immediately, preserves filters, and gates applications on an active channel', async () => {
    const sellerId = await createSeller(`catalog-${crypto.randomUUID()}`);
    const product = await sellerProducts.create(sellerId, productInput, [
      {
        buffer: await testPng(),
        mimetype: 'image/png',
        originalname: 'honey.png',
      } as Express.Multer.File,
      {
        buffer: await testPng(),
        mimetype: 'image/png',
        originalname: 'apiary.png',
      } as Express.Multer.File,
    ]);
    productIds.push(product.id);

    expect(product.state).toBe('available');
    expect(product.acceptingApplications).toBe(false);
    expect(product.images[0].mediumUrl).toContain('-medium.webp');

    const filtered = await catalog.listProducts({
      categoryId,
      search: 'family apiary',
      minPriceKopecks: 12_000,
      maxPriceKopecks: 13_000,
      sortBy: 'price-desc',
    });
    expect(filtered.map((item) => item.id)).toContain(product.id);
    expect(filtered.find((item) => item.id === product.id)?.acceptingApplications).toBe(false);

    await testDatabase.db.insert(channelConnections).values({
      sellerId,
      provider: 'test-messenger',
      destinationEncrypted: 'encrypted',
      destinationFingerprint: crypto.randomUUID(),
      active: true,
      isPrimary: true,
    });
    expect((await catalog.getProduct(product.id)).acceptingApplications).toBe(true);

    const reversed = [...product.images].reverse().map((image) => image.id);
    const reordered = await sellerProducts.reorderImages(sellerId, product.id, reversed);
    expect(reordered.images.map((image) => image.id)).toEqual(reversed);
    expect(reordered.images.map((image) => image.sortOrder)).toEqual([0, 1]);

    await sellerProducts.setState(sellerId, product.id, 'hidden');
    await expect(catalog.getProduct(product.id)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('enforces product ownership and queues storage cleanup on soft delete', async () => {
    const ownerId = await createSeller(`owner-${crypto.randomUUID()}`);
    const strangerId = await createSeller(`stranger-${crypto.randomUUID()}`);
    const product = await sellerProducts.create(ownerId, { ...productInput, name: 'Owner product' }, [
      {
        buffer: await testPng(),
        mimetype: 'image/png',
        originalname: 'owner.png',
      } as Express.Multer.File,
    ]);
    productIds.push(product.id);

    await expect(
      sellerProducts.update(strangerId, product.id, { ...productInput, name: 'Stolen' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    await sellerProducts.delete(ownerId, product.id);
    const [stored] = await testDatabase.db.select().from(products).where(eq(products.id, product.id));
    const cleanup = await testDatabase.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateId, product.id),
          eq(outboxEvents.eventType, 'storage.cleanup_requested'),
        ),
      );
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored.state).toBe('hidden');
    expect(cleanup).toHaveLength(1);
  });

  it('cleans newly uploaded variants when the database transaction fails', async () => {
    const sellerId = await createSeller(`cleanup-${crypto.randomUUID()}`);
    const existing = await sellerProducts.create(sellerId, { ...productInput, name: 'Existing key' }, [
      {
        buffer: await testPng(),
        mimetype: 'image/png',
        originalname: 'existing.png',
      } as Express.Multer.File,
    ]);
    productIds.push(existing.id);
    const [existingImage] = await testDatabase.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, existing.id));
    const fakeVariants: ProcessedProductImage[][] = [[
      { storageKey: existingImage.storageKey.replace('-medium.webp', '-thumbnail.webp'), variant: 'thumbnail', width: 320 },
      { storageKey: existingImage.storageKey, variant: 'medium', width: 960 },
      { storageKey: existingImage.storageKey.replace('-medium.webp', '-large.webp'), variant: 'large', width: 1600 },
    ]];
    const failingProcessor = {
      process: vi.fn().mockResolvedValue(fakeVariants),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProductImageProcessor;
    const service = new SellerProductService(
      testDatabase.db,
      storage,
      failingProcessor,
      'http://localhost:3001',
    );

    await expect(
      service.create(sellerId, { ...productInput, name: 'Must roll back' }, [{} as Express.Multer.File]),
    ).rejects.toThrow();
    expect(failingProcessor.cleanup).toHaveBeenCalledWith(fakeVariants);
    const rows = await testDatabase.db
      .select()
      .from(products)
      .where(and(eq(products.sellerId, sellerId), eq(products.name, 'Must roll back')));
    expect(rows).toHaveLength(0);
  });
});
