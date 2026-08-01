import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  auditEvents,
  sellerDeliveryOptions,
  sellerPublicContacts,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import type {
  ContactInput,
  DeliveryOptionInput,
  OnboardingInput,
  ProfileUpdate,
} from './validation';

function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

export class SellerProfileService {
  constructor(private readonly db: Database) {}

  async getPrivateProfile(sellerId: string) {
    const [seller, contacts, deliveryOptions] = await Promise.all([
      this.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1),
      this.db
        .select()
        .from(sellerPublicContacts)
        .where(eq(sellerPublicContacts.sellerId, sellerId))
        .orderBy(asc(sellerPublicContacts.sortOrder), asc(sellerPublicContacts.createdAt)),
      this.db
        .select()
        .from(sellerDeliveryOptions)
        .where(eq(sellerDeliveryOptions.sellerId, sellerId))
        .orderBy(asc(sellerDeliveryOptions.createdAt)),
    ]);

    if (!seller[0]) throw new AppHttpError('Seller not found', 404, 'SELLER_NOT_FOUND');
    return { profile: this.privateProfile(seller[0]), contacts, deliveryOptions };
  }

  async updateProfile(sellerId: string, input: ProfileUpdate) {
    try {
      return await this.db.transaction(async (transaction) => {
        const [profile] = await transaction
          .update(sellers)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(sellers.id, sellerId))
          .returning();
        if (!profile) throw new AppHttpError('Seller not found', 404, 'SELLER_NOT_FOUND');
        await transaction.insert(auditEvents).values({
          actorKind: 'seller', actorId: sellerId, aggregateType: 'seller',
          aggregateId: sellerId, action: 'seller.profile_updated', metadata: {},
        });
        return this.privateProfile(profile);
      });
    } catch (error) {
      this.rethrowSlugConflict(error);
    }
  }

  async createContact(sellerId: string, input: ContactInput) {
    return this.db.transaction(async (transaction) => {
      const [contact] = await transaction
        .insert(sellerPublicContacts)
        .values({ sellerId, ...input })
        .returning();
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'seller',
        aggregateId: sellerId, action: 'seller.contact_created', metadata: { contactId: contact.id },
      });
      return contact;
    });
  }

  async updateContact(sellerId: string, contactId: string, input: ContactInput) {
    return this.db.transaction(async (transaction) => {
      const [contact] = await transaction
        .update(sellerPublicContacts)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(eq(sellerPublicContacts.id, contactId), eq(sellerPublicContacts.sellerId, sellerId)),
        )
        .returning();
      if (!contact) throw new AppHttpError('Contact not found', 404, 'CONTACT_NOT_FOUND');
      await transaction.insert(auditEvents).values({
        actorKind: 'seller', actorId: sellerId, aggregateType: 'seller',
        aggregateId: sellerId, action: 'seller.contact_updated', metadata: { contactId },
      });
      return contact;
    });
  }

  async deleteContact(sellerId: string, contactId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [deleted] = await transaction
        .delete(sellerPublicContacts)
        .where(
          and(eq(sellerPublicContacts.id, contactId), eq(sellerPublicContacts.sellerId, sellerId)),
        )
        .returning({ id: sellerPublicContacts.id });
      if (!deleted) throw new AppHttpError('Contact not found', 404, 'CONTACT_NOT_FOUND');

      const remaining = await transaction
        .select({ id: sellerPublicContacts.id })
        .from(sellerPublicContacts)
        .where(eq(sellerPublicContacts.sellerId, sellerId))
        .limit(1);
      if (remaining.length === 0) {
        await transaction
          .update(sellers)
          .set({ onboardingCompleted: false, updatedAt: new Date() })
          .where(eq(sellers.id, sellerId));
      }
      await transaction.insert(auditEvents).values({
        actorKind: 'seller',
        actorId: sellerId,
        aggregateType: 'seller',
        aggregateId: sellerId,
        action: 'seller.contact_deleted',
        metadata: { contactId },
      });
    });
  }

  async createDeliveryOption(sellerId: string, input: DeliveryOptionInput) {
    try {
      return await this.db.transaction(async (transaction) => {
        const [option] = await transaction
          .insert(sellerDeliveryOptions)
          .values({ sellerId, ...input })
          .returning();
        await transaction.insert(auditEvents).values({
          actorKind: 'seller', actorId: sellerId, aggregateType: 'seller',
          aggregateId: sellerId, action: 'seller.delivery_created',
          metadata: { deliveryOptionId: option.id },
        });
        return option;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppHttpError(
          'This delivery type already exists',
          409,
          'DELIVERY_TYPE_CONFLICT',
        );
      }
      throw error;
    }
  }

  async updateDeliveryOption(
    sellerId: string,
    deliveryOptionId: string,
    input: DeliveryOptionInput,
  ) {
    try {
      const [option] = await this.db.transaction(async (transaction) => {
        const updated = await transaction
          .update(sellerDeliveryOptions)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(sellerDeliveryOptions.id, deliveryOptionId),
              eq(sellerDeliveryOptions.sellerId, sellerId),
            ),
          )
          .returning();
        if (!updated[0]) {
          throw new AppHttpError('Delivery option not found', 404, 'DELIVERY_OPTION_NOT_FOUND');
        }

        if (!input.active) await this.downgradeIfNoActiveDelivery(transaction, sellerId);
        await transaction.insert(auditEvents).values({
          actorKind: 'seller',
          actorId: sellerId,
          aggregateType: 'seller',
          aggregateId: sellerId,
          action: 'seller.delivery_updated',
          metadata: { deliveryOptionId },
        });
        return updated;
      });
      return option;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppHttpError(
          'This delivery type already exists',
          409,
          'DELIVERY_TYPE_CONFLICT',
        );
      }
      throw error;
    }
  }

  async deleteDeliveryOption(sellerId: string, deliveryOptionId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [deleted] = await transaction
        .delete(sellerDeliveryOptions)
        .where(
          and(
            eq(sellerDeliveryOptions.id, deliveryOptionId),
            eq(sellerDeliveryOptions.sellerId, sellerId),
          ),
        )
        .returning({ id: sellerDeliveryOptions.id });
      if (!deleted) {
        throw new AppHttpError('Delivery option not found', 404, 'DELIVERY_OPTION_NOT_FOUND');
      }

      await this.downgradeIfNoActiveDelivery(transaction, sellerId);
      await transaction.insert(auditEvents).values({
        actorKind: 'seller',
        actorId: sellerId,
        aggregateType: 'seller',
        aggregateId: sellerId,
        action: 'seller.delivery_deleted',
        metadata: { deliveryOptionId },
      });
    });
  }

  async completeOnboarding(sellerId: string, input: OnboardingInput) {
    try {
      await this.db.transaction(async (transaction) => {
        const [seller] = await transaction
          .update(sellers)
          .set({ ...input.profile, onboardingCompleted: true, updatedAt: new Date() })
          .where(eq(sellers.id, sellerId))
          .returning({ id: sellers.id });
        if (!seller) throw new AppHttpError('Seller not found', 404, 'SELLER_NOT_FOUND');

        await transaction
          .delete(sellerPublicContacts)
          .where(eq(sellerPublicContacts.sellerId, sellerId));
        await transaction
          .delete(sellerDeliveryOptions)
          .where(eq(sellerDeliveryOptions.sellerId, sellerId));
        await transaction
          .insert(sellerPublicContacts)
          .values(input.contacts.map((contact) => ({ sellerId, ...contact })));
        await transaction
          .insert(sellerDeliveryOptions)
          .values(input.deliveryOptions.map((option) => ({ sellerId, ...option })));
        await transaction.insert(auditEvents).values({
          actorKind: 'seller',
          actorId: sellerId,
          aggregateType: 'seller',
          aggregateId: sellerId,
          action: 'seller.onboarding_completed',
          metadata: {},
        });
      });
      return this.getPrivateProfile(sellerId);
    } catch (error) {
      this.rethrowSlugConflict(error);
    }
  }

  private privateProfile(seller: typeof sellers.$inferSelect) {
    return {
      id: seller.id,
      status: seller.status,
      slug: seller.slug,
      storeName: seller.storeName,
      description: seller.description,
      region: seller.region,
      onboardingCompleted: seller.onboardingCompleted,
    };
  }

  private async downgradeIfNoActiveDelivery(
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
    sellerId: string,
  ) {
    const active = await transaction
      .select({ id: sellerDeliveryOptions.id })
      .from(sellerDeliveryOptions)
      .where(
        and(
          eq(sellerDeliveryOptions.sellerId, sellerId),
          eq(sellerDeliveryOptions.active, true),
        ),
      )
      .limit(1);
    if (active.length === 0) {
      await transaction
        .update(sellers)
        .set({ onboardingCompleted: false, updatedAt: new Date() })
        .where(eq(sellers.id, sellerId));
    }
  }

  private rethrowSlugConflict(error: unknown): never {
    if (isUniqueViolation(error)) {
      throw new AppHttpError('Store slug is already taken', 409, 'SLUG_CONFLICT');
    }
    throw error;
  }
}
