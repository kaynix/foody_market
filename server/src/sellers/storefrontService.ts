import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  productImages,
  products,
  sellerDeliveryOptions,
  sellerPublicContacts,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import type { FileStorageAdapter } from '../storage/types';
import { publicImageUrls } from '../catalog/presenters';

export class StorefrontService {
  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageAdapter,
    private readonly publicApiUrl: string,
  ) {}

  async getPublicStorefront(slug: string) {
    const [seller] = await this.db
      .select({
        id: sellers.id,
        slug: sellers.slug,
        storeName: sellers.storeName,
        description: sellers.description,
        region: sellers.region,
      })
      .from(sellers)
      .where(
        and(
          eq(sellers.slug, slug),
          eq(sellers.status, 'active'),
          eq(sellers.onboardingCompleted, true),
        ),
      )
      .limit(1);
    if (!seller) throw new AppHttpError('Storefront not found', 404, 'STOREFRONT_NOT_FOUND');

    const [contacts, deliveryOptions, productRows] = await Promise.all([
      this.db
        .select({
          id: sellerPublicContacts.id,
          type: sellerPublicContacts.type,
          label: sellerPublicContacts.label,
          value: sellerPublicContacts.value,
        })
        .from(sellerPublicContacts)
        .where(eq(sellerPublicContacts.sellerId, seller.id))
        .orderBy(asc(sellerPublicContacts.sortOrder)),
      this.db
        .select({
          id: sellerDeliveryOptions.id,
          type: sellerDeliveryOptions.type,
          instructions: sellerDeliveryOptions.instructions,
        })
        .from(sellerDeliveryOptions)
        .where(
          and(
            eq(sellerDeliveryOptions.sellerId, seller.id),
            eq(sellerDeliveryOptions.active, true),
          ),
        ),
      this.db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          name: products.name,
          description: products.description,
          priceKopecks: products.priceKopecks,
          unit: products.unit,
          minimumQuantity: products.minimumQuantity,
        })
        .from(products)
        .where(
          and(
            eq(products.sellerId, seller.id),
            eq(products.state, 'available'),
            isNull(products.deletedAt),
          ),
        )
        .orderBy(asc(products.createdAt)),
    ]);

    const images = productRows.length
      ? await this.db
          .select({
            productId: productImages.productId,
            storageKey: productImages.storageKey,
            altText: productImages.altText,
            sortOrder: productImages.sortOrder,
          })
          .from(productImages)
          .where(inArray(productImages.productId, productRows.map((product) => product.id)))
          .orderBy(asc(productImages.sortOrder))
      : [];
    const imagesByProduct = new Map<string, typeof images>();
    for (const image of images) {
      const current = imagesByProduct.get(image.productId) ?? [];
      current.push(image);
      imagesByProduct.set(image.productId, current);
    }

    return {
      store: seller,
      contacts,
      deliveryOptions,
      products: productRows.map((product) => ({
        ...product,
        images: (imagesByProduct.get(product.id) ?? []).map((image) => ({
          altText: image.altText,
          sortOrder: image.sortOrder,
          ...publicImageUrls(image.storageKey, this.storage, this.publicApiUrl),
        })),
      })),
    };
  }
}
