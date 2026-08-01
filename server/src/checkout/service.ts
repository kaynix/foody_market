import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { createOpaqueToken } from '../auth/tokens';
import type { Database } from '../db/client';
import {
  applicationItems,
  auditEvents,
  channelConnections,
  checkoutGroups,
  deliverySelections,
  outboxEvents,
  products,
  sellerApplications,
  sellerDeliveryOptions,
  sellerPublicContacts,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import type { ChannelLinkIntentService } from '../messaging/linkIntentService';
import type { ApplicationService } from '../applications/service';
import { decryptString, encryptString, hashSecret } from '../security/crypto';
import type { CheckoutCreateInput, CheckoutLineInput } from './validation';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Transaction;

export interface CheckoutValidationError {
  scope: 'line' | 'seller';
  code: string;
  productId?: string;
  sellerId?: string;
  message: string;
}

const MAX_DB_INTEGER = 2_147_483_647;

export class CheckoutService {
  constructor(
    private readonly db: Database,
    private readonly links: ChannelLinkIntentService,
    private readonly secret: string,
    private readonly encryptionKey: string,
    private readonly applications: ApplicationService,
  ) {}

  validate(lines: CheckoutLineInput[]) {
    return this.buildPreflight(this.db, lines);
  }

  async create(input: CheckoutCreateInput) {
    const trackingToken = createOpaqueToken();
    const result = await this.db.transaction(async (transaction) => {
      const preflight = await this.buildPreflight(transaction, input.lines, true);
      const errors = [...preflight.errors];
      const deliveryBySeller = new Map(input.deliveries.map((delivery) => [delivery.sellerId, delivery]));
      if (deliveryBySeller.size !== input.deliveries.length) {
        errors.push({ scope: 'seller', code: 'DELIVERY_DUPLICATE', message: 'Delivery may be selected once per seller' });
      }
      for (const group of preflight.groups) {
        const selected = deliveryBySeller.get(group.seller.id);
        if (!selected || !group.deliveryOptions.some((option) => option.type === selected.type)) {
          errors.push({
            scope: 'seller', sellerId: group.seller.id, code: 'DELIVERY_INVALID',
            message: 'Select an active delivery option for this seller',
          });
        }
      }
      if (
        deliveryBySeller.size !== preflight.groups.length
        || [...deliveryBySeller.keys()].some((sellerId) => !preflight.groups.some((group) => group.seller.id === sellerId))
      ) {
        errors.push({ scope: 'seller', code: 'DELIVERY_SET_INVALID', message: 'Delivery selections do not match seller groups' });
      }
      if (errors.length) {
        throw new AppHttpError('Checkout validation failed', 409, 'CHECKOUT_INVALID', {
          valid: false, groups: preflight.groups, errors,
        });
      }

      const buyerChannel = await this.links.consumeBuyerIntent(
        transaction, input.channel.provider, input.channel.browserSecret,
      );
      const groupId = randomUUID();
      await transaction.insert(checkoutGroups).values({
        id: groupId,
        buyerNameEncrypted: encryptString(input.buyer.name, this.encryptionKey),
        buyerPhoneEncrypted: encryptString(input.buyer.phone, this.encryptionKey),
        buyerChannelProvider: buyerChannel.provider,
        buyerChannelDestinationEncrypted: buyerChannel.destinationEncrypted,
        buyerChannelFingerprint: buyerChannel.destinationFingerprint,
        trackingTokenHash: hashSecret(trackingToken, this.secret),
      });

      const applicationIds: string[] = [];
      const acceptedProductIds: string[] = [];
      for (const group of preflight.groups) {
        const applicationId = randomUUID();
        applicationIds.push(applicationId);
        acceptedProductIds.push(...group.items.map((item) => item.productId));
        await transaction.insert(sellerApplications).values({
          id: applicationId,
          checkoutGroupId: groupId,
          sellerId: group.seller.id,
          amountKopecks: group.subtotalKopecks,
        });
        await transaction.insert(applicationItems).values(group.items.map((item) => ({
          applicationId,
          productId: item.productId,
          productName: item.name,
          unit: item.unit,
          unitPriceKopecks: item.priceKopecks,
          quantity: item.quantity,
          lineTotalKopecks: item.lineTotalKopecks,
        })));
        const selected = deliveryBySeller.get(group.seller.id)!;
        const option = group.deliveryOptions.find((item) => item.type === selected.type)!;
        await transaction.insert(deliverySelections).values({
          applicationId,
          type: selected.type,
          detailsEncrypted: encryptString(selected.details, this.encryptionKey),
          instructionsSnapshot: option.instructions,
        });
        await transaction.insert(outboxEvents).values({
          aggregateType: 'application', aggregateId: applicationId,
          eventType: 'application.created', idempotencyKey: `application:${applicationId}:created:seller`,
        });
      }
      await transaction.insert(outboxEvents).values({
        aggregateType: 'checkout_group', aggregateId: groupId,
        eventType: 'checkout.created', idempotencyKey: `checkout:${groupId}:created:buyer`,
      });
      await transaction.insert(auditEvents).values({
        actorKind: 'buyer', actorId: null, aggregateType: 'checkout_group',
        aggregateId: groupId, action: 'checkout.created', metadata: { applicationCount: applicationIds.length },
      });
      return { groupId, applicationIds, acceptedProductIds };
    });
    return { ...result, trackingToken };
  }

  async getTracking(groupId: string, trackingToken: string) {
    const [group] = await this.db.select({
      id: checkoutGroups.id,
      createdAt: checkoutGroups.createdAt,
    }).from(checkoutGroups).where(and(
      eq(checkoutGroups.id, groupId),
      eq(checkoutGroups.trackingTokenHash, hashSecret(trackingToken, this.secret)),
    )).limit(1);
    if (!group) throw new AppHttpError('Tracking group not found', 404, 'TRACKING_NOT_FOUND');

    const applications = await this.db.select({
      id: sellerApplications.id,
      status: sellerApplications.status,
      amountKopecks: sellerApplications.amountKopecks,
      createdAt: sellerApplications.createdAt,
      updatedAt: sellerApplications.updatedAt,
      seller: { id: sellers.id, slug: sellers.slug, storeName: sellers.storeName },
    }).from(sellerApplications)
      .innerJoin(sellers, eq(sellerApplications.sellerId, sellers.id))
      .where(eq(sellerApplications.checkoutGroupId, groupId))
      .orderBy(asc(sellerApplications.createdAt));
    const applicationIds = applications.map((application) => application.id);
    const sellerIds = applications.map((application) => application.seller.id);
    const [items, deliveries, contacts] = applicationIds.length ? await Promise.all([
      this.db.select().from(applicationItems).where(inArray(applicationItems.applicationId, applicationIds)),
      this.db.select().from(deliverySelections).where(inArray(deliverySelections.applicationId, applicationIds)),
      this.db.select({
        id: sellerPublicContacts.id, sellerId: sellerPublicContacts.sellerId,
        type: sellerPublicContacts.type, label: sellerPublicContacts.label,
        value: sellerPublicContacts.value, sortOrder: sellerPublicContacts.sortOrder,
      }).from(sellerPublicContacts).where(inArray(sellerPublicContacts.sellerId, sellerIds)),
    ]) : [[], [], []];

    return {
      id: group.id,
      createdAt: group.createdAt,
      applications: applications.map((application) => {
        const delivery = deliveries.find((item) => item.applicationId === application.id)!;
        return {
          ...application,
          items: items.filter((item) => item.applicationId === application.id).map((item) => ({
            id: item.id, productId: item.productId, productName: item.productName,
            unit: item.unit, unitPriceKopecks: item.unitPriceKopecks,
            quantity: item.quantity, lineTotalKopecks: item.lineTotalKopecks,
          })),
          delivery: {
            type: delivery.type,
            details: decryptString(delivery.detailsEncrypted, this.encryptionKey),
            instructions: delivery.instructionsSnapshot,
          },
          contacts: contacts.filter((contact) => contact.sellerId === application.seller.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map(({ sellerId: _sellerId, sortOrder: _sortOrder, ...contact }) => contact),
        };
      }),
    };
  }

  async cancel(groupId: string, applicationId: string, trackingToken: string) {
    const [group] = await this.db.select({ id: checkoutGroups.id }).from(checkoutGroups).where(and(
      eq(checkoutGroups.id, groupId),
      eq(checkoutGroups.trackingTokenHash, hashSecret(trackingToken, this.secret)),
    )).limit(1);
    if (!group) throw new AppHttpError('Tracking group not found', 404, 'TRACKING_NOT_FOUND');
    return this.applications.transitionBuyer(groupId, applicationId);
  }

  private async buildPreflight(
    executor: Executor,
    lines: Array<CheckoutLineInput & { expectedPriceKopecks?: number }>,
    lockRows = false,
  ) {
    const quantities = new Map<string, number>();
    const expectedPrices = new Map<string, number>();
    for (const line of lines) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
      if (line.expectedPriceKopecks !== undefined) {
        const previous = expectedPrices.get(line.productId);
        if (previous !== undefined && previous !== line.expectedPriceKopecks) {
          throw new AppHttpError('Conflicting expected prices', 400, 'VALIDATION_ERROR');
        }
        expectedPrices.set(line.productId, line.expectedPriceKopecks);
      }
    }
    const productIds = [...quantities.keys()];
    const productQuery = executor.select({
      product: products,
      seller: {
        id: sellers.id, slug: sellers.slug, storeName: sellers.storeName,
        status: sellers.status, onboardingCompleted: sellers.onboardingCompleted,
      },
    }).from(products).innerJoin(sellers, eq(products.sellerId, sellers.id))
      .where(inArray(products.id, productIds));
    const rows = lockRows ? await productQuery.for('share') : await productQuery;
    const sellerIds = [...new Set(rows.map((row) => row.seller.id))];
    const activeChannels = sellerIds.length ? await this.readActiveChannels(executor, sellerIds, lockRows) : [];
    const deliveryOptions = sellerIds.length ? await this.readDeliveryOptions(executor, sellerIds, lockRows) : [];
    const activeSellerIds = new Set(activeChannels.map((item) => item.sellerId));
    const errors: CheckoutValidationError[] = [];
    for (const productId of productIds) {
      if (!rows.some((row) => row.product.id === productId)) {
        errors.push({ scope: 'line', productId, code: 'PRODUCT_NOT_FOUND', message: 'Product is unavailable' });
      }
    }
    const groups = new Map<string, {
      seller: { id: string; slug: string; storeName: string };
      items: Array<{ productId: string; name: string; unit: string; priceKopecks: number; quantity: number; lineTotalKopecks: number }>;
      deliveryOptions: Array<{ id: string; type: 'nova_poshta' | 'pickup' | 'arrangement'; instructions: string }>;
      subtotalKopecks: number;
    }>();
    for (const row of rows) {
      const quantity = quantities.get(row.product.id)!;
      if (row.product.state !== 'available' || row.product.deletedAt) {
        errors.push({ scope: 'line', productId: row.product.id, code: 'PRODUCT_UNAVAILABLE', message: 'Product is hidden or deleted' });
      }
      const expectedPrice = expectedPrices.get(row.product.id);
      if (expectedPrice !== undefined && expectedPrice !== row.product.priceKopecks) {
        errors.push({
          scope: 'line', productId: row.product.id, code: 'PRICE_CHANGED',
          message: 'Product price changed after cart validation',
        });
      }
      if (quantity < row.product.minimumQuantity) {
        errors.push({ scope: 'line', productId: row.product.id, code: 'QUANTITY_BELOW_MINIMUM', message: `Minimum quantity is ${row.product.minimumQuantity}` });
      }
      const lineTotalKopecks = row.product.priceKopecks * quantity;
      if (!Number.isSafeInteger(lineTotalKopecks) || lineTotalKopecks > MAX_DB_INTEGER) {
        errors.push({ scope: 'line', productId: row.product.id, code: 'AMOUNT_TOO_LARGE', message: 'Line total is too large' });
      }
      let group = groups.get(row.seller.id);
      if (!group) {
        group = {
          seller: { id: row.seller.id, slug: row.seller.slug, storeName: row.seller.storeName },
          items: [],
          deliveryOptions: deliveryOptions.filter((option) => option.sellerId === row.seller.id)
            .map(({ sellerId: _sellerId, ...option }) => option),
          subtotalKopecks: 0,
        };
        groups.set(row.seller.id, group);
        if (row.seller.status !== 'active' || !row.seller.onboardingCompleted || !activeSellerIds.has(row.seller.id)) {
          errors.push({ scope: 'seller', sellerId: row.seller.id, code: 'SELLER_UNAVAILABLE', message: 'Seller is not accepting applications' });
        }
        if (group.deliveryOptions.length === 0) {
          errors.push({ scope: 'seller', sellerId: row.seller.id, code: 'DELIVERY_UNAVAILABLE', message: 'Seller has no active delivery options' });
        }
      }
      group.items.push({
        productId: row.product.id, name: row.product.name, unit: row.product.unit,
        priceKopecks: row.product.priceKopecks, quantity, lineTotalKopecks,
      });
      group.subtotalKopecks += lineTotalKopecks;
      if (group.subtotalKopecks > MAX_DB_INTEGER) {
        errors.push({ scope: 'seller', sellerId: row.seller.id, code: 'AMOUNT_TOO_LARGE', message: 'Seller subtotal is too large' });
      }
    }
    return { valid: errors.length === 0, groups: [...groups.values()], errors };
  }

  private async readActiveChannels(executor: Executor, sellerIds: string[], lockRows: boolean) {
    const query = executor.select({ sellerId: channelConnections.sellerId })
      .from(channelConnections).where(and(
        inArray(channelConnections.sellerId, sellerIds), eq(channelConnections.active, true),
      ));
    return lockRows ? query.for('share') : query;
  }

  private async readDeliveryOptions(executor: Executor, sellerIds: string[], lockRows: boolean) {
    const query = executor.select({
      id: sellerDeliveryOptions.id, sellerId: sellerDeliveryOptions.sellerId,
      type: sellerDeliveryOptions.type, instructions: sellerDeliveryOptions.instructions,
    }).from(sellerDeliveryOptions).where(and(
      inArray(sellerDeliveryOptions.sellerId, sellerIds), eq(sellerDeliveryOptions.active, true),
    ));
    return lockRows ? query.for('share') : query;
  }
}
