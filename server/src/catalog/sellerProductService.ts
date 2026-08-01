import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  auditEvents,
  categories,
  channelConnections,
  outboxEvents,
  productImages,
  products,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import type { ProductImageProcessor } from '../storage/images';
import type { FileStorageAdapter } from '../storage/types';
import { publicImageUrls } from './presenters';
import type { ProductInput } from './validation';

export class SellerProductService {
  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageAdapter,
    private readonly imageProcessor: ProductImageProcessor,
    private readonly publicApiUrl: string,
  ) {}

  async listOwn(sellerId: string) {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.sellerId, sellerId), isNull(products.deletedAt)))
      .orderBy(asc(products.createdAt));
    return this.presentOwn(rows);
  }

  async create(sellerId: string, input: ProductInput, files: Express.Multer.File[]) {
    const [seller, category] = await Promise.all([
      this.db
        .select({ onboardingCompleted: sellers.onboardingCompleted })
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1),
      this.db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1),
    ]);
    if (!seller[0]?.onboardingCompleted) {
      throw new AppHttpError('Complete seller onboarding first', 409, 'ONBOARDING_REQUIRED');
    }
    if (!category[0]) throw new AppHttpError('Category not found', 400, 'CATEGORY_INVALID');

    const productId = randomUUID();
    const processed = await this.imageProcessor.process(files, sellerId, productId);
    try {
      await this.db.transaction(async (transaction) => {
        await transaction.insert(products).values({ id: productId, sellerId, ...input });
        await transaction.insert(productImages).values(
          processed.map((variants, sortOrder) => {
            const medium = variants.find((variant) => variant.variant === 'medium');
            if (!medium) throw new Error('Medium image variant is missing');
            return {
              productId,
              storageKey: medium.storageKey,
              altText: input.name,
              sortOrder,
            };
          }),
        );
        await transaction.insert(auditEvents).values({
          actorKind: 'seller',
          actorId: sellerId,
          aggregateType: 'product',
          aggregateId: productId,
          action: 'product.created',
          metadata: {},
        });
      });
    } catch (error) {
      await this.imageProcessor.cleanup(processed);
      throw error;
    }
    return this.getOwn(sellerId, productId);
  }

  async update(sellerId: string, productId: string, input: ProductInput) {
    const category = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1);
    if (!category[0]) throw new AppHttpError('Category not found', 400, 'CATEGORY_INVALID');

    await this.db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(products)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, productId),
            eq(products.sellerId, sellerId),
            isNull(products.deletedAt),
          ),
        )
        .returning({ id: products.id });
      if (!updated) throw new AppHttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'product',
        aggregateId: productId, action: 'product.updated', metadata: {},
      });
    });
    return this.getOwn(sellerId, productId);
  }

  async setState(sellerId: string, productId: string, state: 'available' | 'hidden') {
    const [updated] = await this.db.transaction(async (transaction) => {
      const rows = await transaction
        .update(products)
        .set({ state, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, productId),
            eq(products.sellerId, sellerId),
            isNull(products.deletedAt),
          ),
        )
        .returning({ id: products.id });
      if (!rows[0]) throw new AppHttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'product',
        aggregateId: productId, action: `product.${state}`, metadata: {},
      });
      return rows;
    });
    return this.getOwn(sellerId, updated.id);
  }

  async reorderImages(sellerId: string, productId: string, imageIds: string[]) {
    await this.db.transaction(async (transaction) => {
      const ownedImages = await transaction
        .select({ id: productImages.id })
        .from(productImages)
        .innerJoin(products, eq(productImages.productId, products.id))
        .where(
          and(
            eq(products.id, productId),
            eq(products.sellerId, sellerId),
            isNull(products.deletedAt),
          ),
        );
      const ownedIds = new Set(ownedImages.map((image) => image.id));
      if (ownedIds.size !== imageIds.length || imageIds.some((id) => !ownedIds.has(id))) {
        throw new AppHttpError('Image order must contain every owned image', 400, 'IMAGE_ORDER_INVALID');
      }
      for (const [temporaryOrder, image] of ownedImages.entries()) {
        await transaction
          .update(productImages)
          .set({ sortOrder: 10_000 + temporaryOrder })
          .where(and(eq(productImages.id, image.id), eq(productImages.productId, productId)));
      }
      for (const [sortOrder, imageId] of imageIds.entries()) {
        await transaction
          .update(productImages)
          .set({ sortOrder })
          .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
      }
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'product',
        aggregateId: productId, action: 'product.images_reordered', metadata: {},
      });
    });
    return this.getOwn(sellerId, productId);
  }

  async delete(sellerId: string, productId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [deleted] = await transaction
        .update(products)
        .set({ state: 'hidden', deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(products.id, productId),
            eq(products.sellerId, sellerId),
            isNull(products.deletedAt),
          ),
        )
        .returning({ id: products.id });
      if (!deleted) throw new AppHttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
      await transaction.insert(outboxEvents).values({
        aggregateType: 'product',
        aggregateId: productId,
        eventType: 'storage.cleanup_requested',
        idempotencyKey: `product:${productId}:storage-cleanup`,
      });
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'product',
        aggregateId: productId, action: 'product.deleted', metadata: {},
      });
    });
  }

  private async getOwn(sellerId: string, productId: string) {
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.sellerId, sellerId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new AppHttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    const [product] = await this.presentOwn(rows);
    return product;
  }

  private async presentOwn(rows: Array<typeof products.$inferSelect>) {
    if (!rows.length) return [];
    const [images, activeChannel] = await Promise.all([
      this.db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((product) => product.id)))
        .orderBy(asc(productImages.sortOrder)),
      this.db
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.sellerId, rows[0].sellerId),
            eq(channelConnections.active, true),
          ),
        )
        .limit(1),
    ]);
    const imagesByProduct = new Map<string, typeof images>();
    for (const image of images) {
      const current = imagesByProduct.get(image.productId) ?? [];
      current.push(image);
      imagesByProduct.set(image.productId, current);
    }
    return rows.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      priceKopecks: product.priceKopecks,
      unit: product.unit,
      minimumQuantity: product.minimumQuantity,
      state: product.state,
      acceptingApplications: activeChannel.length > 0,
      images: (imagesByProduct.get(product.id) ?? []).map((image) => ({
        id: image.id,
        altText: image.altText,
        sortOrder: image.sortOrder,
        ...publicImageUrls(image.storageKey, this.storage, this.publicApiUrl),
      })),
    }));
  }
}
