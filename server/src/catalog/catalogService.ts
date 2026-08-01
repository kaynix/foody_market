import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { categories, channelConnections, productImages, products, sellers } from '../db/schema';
import { AppHttpError } from '../http/errors';
import type { FileStorageAdapter } from '../storage/types';
import { publicImageUrls } from './presenters';

export interface CatalogFilters {
  categoryId?: number;
  search?: string;
  minPriceKopecks?: number;
  maxPriceKopecks?: number;
  sortBy?: 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
}

export class CatalogService {
  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageAdapter,
    private readonly publicApiUrl: string,
  ) {}

  async listProducts(filters: CatalogFilters = {}) {
    const conditions: SQL[] = [eq(products.state, 'available'), isNull(products.deletedAt)];
    if (filters.categoryId !== undefined) conditions.push(eq(products.categoryId, filters.categoryId));
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(or(ilike(products.name, term), ilike(products.description, term))!);
    }
    if (filters.minPriceKopecks !== undefined) conditions.push(gte(products.priceKopecks, filters.minPriceKopecks));
    if (filters.maxPriceKopecks !== undefined) conditions.push(lte(products.priceKopecks, filters.maxPriceKopecks));

    const order = filters.sortBy === 'price-desc'
      ? desc(products.priceKopecks)
      : filters.sortBy === 'name-asc'
        ? asc(products.name)
        : filters.sortBy === 'name-desc'
          ? desc(products.name)
          : asc(products.priceKopecks);
    const rows = await this.db
      .select({
        product: products,
        seller: {
          id: sellers.id,
          slug: sellers.slug,
          storeName: sellers.storeName,
          onboardingCompleted: sellers.onboardingCompleted,
        },
      })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .where(and(...conditions))
      .orderBy(order);
    return this.presentRows(rows);
  }

  async getProduct(productId: string) {
    const [row] = await this.db
      .select({
        product: products,
        seller: {
          id: sellers.id,
          slug: sellers.slug,
          storeName: sellers.storeName,
          onboardingCompleted: sellers.onboardingCompleted,
        },
      })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .where(
        and(
          eq(products.id, productId),
          eq(products.state, 'available'),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new AppHttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    const [product] = await this.presentRows([row]);
    return product;
  }

  async listCategories() {
    return this.db.select().from(categories).orderBy(asc(categories.id));
  }

  async getCategoryBySlug(slug: string) {
    const [category] = await this.db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!category) throw new AppHttpError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    const productsForCategory = await this.listProducts({ categoryId: category.id });
    return { category, products: productsForCategory };
  }

  private async presentRows(
    rows: Array<{
      product: typeof products.$inferSelect;
      seller: { id: string; slug: string; storeName: string; onboardingCompleted: boolean };
    }>,
  ) {
    if (!rows.length) return [];
    const productIds = rows.map((row) => row.product.id);
    const sellerIds = [...new Set(rows.map((row) => row.seller.id))];
    const [images, activeChannels] = await Promise.all([
      this.db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.sortOrder)),
      this.db
        .select({ sellerId: channelConnections.sellerId })
        .from(channelConnections)
        .where(
          and(
            inArray(channelConnections.sellerId, sellerIds),
            eq(channelConnections.active, true),
          ),
        ),
    ]);
    const activeSellerIds = new Set(activeChannels.map((channel) => channel.sellerId));
    const imagesByProduct = new Map<string, typeof images>();
    for (const image of images) {
      const current = imagesByProduct.get(image.productId) ?? [];
      current.push(image);
      imagesByProduct.set(image.productId, current);
    }

    return rows.map(({ product, seller }) => {
      const presentedImages = (imagesByProduct.get(product.id) ?? []).map((image) => ({
        id: image.id,
        altText: image.altText,
        sortOrder: image.sortOrder,
        ...publicImageUrls(image.storageKey, this.storage, this.publicApiUrl),
      }));
      return {
        id: product.id,
        seller: { id: seller.id, slug: seller.slug, storeName: seller.storeName },
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        priceKopecks: product.priceKopecks,
        unit: product.unit,
        minimumQuantity: product.minimumQuantity,
        images: presentedImages,
        image: presentedImages[0]?.mediumUrl ?? null,
        acceptingApplications: seller.onboardingCompleted && activeSellerIds.has(seller.id),
      };
    });
  }
}
