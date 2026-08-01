import { categories as mockCategories, mockProducts } from '../data/mockData';
import { database, inTransaction } from './client';
import { env } from '../config/env';
import { hashSecret } from '../security/crypto';
import {
  categories,
  productImages,
  products,
  sellerDeliveryOptions,
  sellerPublicContacts,
  sellers,
} from './schema';

const DEMO_SELLER_ID = '00000000-0000-4000-8000-000000000000';

function stableUuid(namespace: number, value: number): string {
  const group = namespace.toString(16).padStart(4, '0');
  const suffix = value.toString(16).padStart(12, '0');
  return `00000000-0000-4${group.slice(1)}-8000-${suffix}`;
}

async function seed() {
  await inTransaction(async (transaction) => {
    await transaction
      .insert(sellers)
      .values({
        id: DEMO_SELLER_ID,
        identityProvider: 'development',
        providerSubjectHash: hashSecret('development:demo-seller', env.SESSION_SECRET),
        slug: 'demo-market',
        storeName: 'Hutorynok Demo Market',
        description: 'Development seller for the seeded catalogue.',
        region: 'Ukraine',
        onboardingCompleted: false,
      })
      .onConflictDoUpdate({
        target: sellers.id,
        set: {
          storeName: 'Hutorynok Demo Market',
          providerSubjectHash: hashSecret('development:demo-seller', env.SESSION_SECRET),
          description: 'Development seller for the seeded catalogue.',
          region: 'Ukraine',
          updatedAt: new Date(),
        },
      });

    await transaction
      .insert(sellerPublicContacts)
      .values({
        id: stableUuid(2, 1),
        sellerId: DEMO_SELLER_ID,
        type: 'phone',
        label: 'Development contact',
        value: '+380000000000',
      })
      .onConflictDoUpdate({
        target: sellerPublicContacts.id,
        set: { label: 'Development contact', value: '+380000000000', updatedAt: new Date() },
      });

    for (const [index, option] of [
      { type: 'nova_poshta' as const, instructions: 'Enter city and branch number.' },
      { type: 'pickup' as const, instructions: 'Pickup details are agreed with the seller.' },
    ].entries()) {
      await transaction
        .insert(sellerDeliveryOptions)
        .values({
          id: stableUuid(3, index + 1),
          sellerId: DEMO_SELLER_ID,
          type: option.type,
          instructions: option.instructions,
        })
        .onConflictDoUpdate({
          target: sellerDeliveryOptions.id,
          set: { instructions: option.instructions, active: true, updatedAt: new Date() },
        });
    }

    for (const category of mockCategories) {
      await transaction
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.id,
          set: { name: category.name, slug: category.slug },
        });
    }

    for (const product of mockProducts) {
      const productId = stableUuid(4, product.id);
      await transaction
        .insert(products)
        .values({
          id: productId,
          sellerId: DEMO_SELLER_ID,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          priceKopecks: Math.round(product.price * 100),
          unit: 'piece',
          minimumQuantity: 1,
          state: 'available',
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            priceKopecks: Math.round(product.price * 100),
            unit: 'piece',
            minimumQuantity: 1,
            state: 'available',
            deletedAt: null,
            updatedAt: new Date(),
          },
        });

      await transaction
        .insert(productImages)
        .values({
          id: stableUuid(5, product.id),
          productId,
          storageKey: product.image,
          altText: product.name,
          sortOrder: 0,
        })
        .onConflictDoUpdate({
          target: productImages.id,
          set: { storageKey: product.image, altText: product.name, sortOrder: 0 },
        });
    }
  });
}

seed()
  .then(async () => {
    console.log(`Seeded ${mockCategories.length} categories and ${mockProducts.length} products.`);
    await database.pool.end();
  })
  .catch(async (error: unknown) => {
    console.error('Database seed failed:', error);
    await database.pool.end();
    process.exitCode = 1;
  });
