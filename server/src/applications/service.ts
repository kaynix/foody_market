import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  applicationItems,
  auditEvents,
  channelConnections,
  checkoutGroups,
  deliverySelections,
  outboxEvents,
  sellerApplications,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import { decryptString } from '../security/crypto';

type ApplicationStatus = typeof sellerApplications.$inferSelect.status;
type TargetStatus = Exclude<ApplicationStatus, 'new'>;

export interface ApplicationFilters {
  status?: ApplicationStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export class ApplicationService {
  constructor(private readonly db: Database, private readonly encryptionKey: string) {}

  async listSeller(sellerId: string, filters: ApplicationFilters = {}) {
    const conditions = [eq(sellerApplications.sellerId, sellerId)];
    if (filters.status) conditions.push(eq(sellerApplications.status, filters.status));
    if (filters.dateFrom) conditions.push(gte(sellerApplications.createdAt, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(sellerApplications.createdAt, filters.dateTo));
    const applications = await this.db.select({
      id: sellerApplications.id,
      status: sellerApplications.status,
      amountKopecks: sellerApplications.amountKopecks,
      createdAt: sellerApplications.createdAt,
      updatedAt: sellerApplications.updatedAt,
      checkoutGroupId: sellerApplications.checkoutGroupId,
    }).from(sellerApplications).where(and(...conditions)).orderBy(desc(sellerApplications.createdAt));
    const applicationIds = applications.map((item) => item.id);
    const itemRows = applicationIds.length ? await this.db.select({
      applicationId: applicationItems.applicationId,
      quantity: applicationItems.quantity,
    }).from(applicationItems).where(inArray(applicationItems.applicationId, applicationIds)) : [];
    return applications.map((application) => ({
      ...application,
      lineCount: itemRows.filter((item) => item.applicationId === application.id).length,
      itemCount: itemRows.filter((item) => item.applicationId === application.id)
        .reduce((total, item) => total + item.quantity, 0),
    }));
  }

  async getSellerDetail(sellerId: string, applicationId: string) {
    const [application] = await this.db.select({
      id: sellerApplications.id,
      status: sellerApplications.status,
      amountKopecks: sellerApplications.amountKopecks,
      createdAt: sellerApplications.createdAt,
      updatedAt: sellerApplications.updatedAt,
      checkoutGroupId: sellerApplications.checkoutGroupId,
      buyerNameEncrypted: checkoutGroups.buyerNameEncrypted,
      buyerPhoneEncrypted: checkoutGroups.buyerPhoneEncrypted,
    }).from(sellerApplications)
      .innerJoin(checkoutGroups, eq(sellerApplications.checkoutGroupId, checkoutGroups.id))
      .where(and(eq(sellerApplications.id, applicationId), eq(sellerApplications.sellerId, sellerId)))
      .limit(1);
    if (!application) throw new AppHttpError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    const [items, delivery] = await Promise.all([
      this.db.select().from(applicationItems)
        .where(eq(applicationItems.applicationId, applicationId)).orderBy(asc(applicationItems.id)),
      this.db.select().from(deliverySelections)
        .where(eq(deliverySelections.applicationId, applicationId)).limit(1),
    ]);
    if (!delivery[0]) throw new AppHttpError('Delivery snapshot not found', 500, 'DELIVERY_SNAPSHOT_MISSING');
    return {
      id: application.id,
      status: application.status,
      amountKopecks: application.amountKopecks,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      buyer: {
        name: decryptString(application.buyerNameEncrypted, this.encryptionKey),
        phone: decryptString(application.buyerPhoneEncrypted, this.encryptionKey),
      },
      items: items.map((item) => ({
        id: item.id, productId: item.productId, productName: item.productName,
        unit: item.unit, unitPriceKopecks: item.unitPriceKopecks,
        quantity: item.quantity, lineTotalKopecks: item.lineTotalKopecks,
      })),
      delivery: {
        type: delivery[0].type,
        details: decryptString(delivery[0].detailsEncrypted, this.encryptionKey),
        instructions: delivery[0].instructionsSnapshot,
      },
    };
  }

  async transitionSeller(sellerId: string, applicationId: string, target: TargetStatus) {
    return this.transition({ actor: 'seller', sellerId, applicationId, target });
  }

  async transitionBuyer(groupId: string, applicationId: string) {
    return this.transition({ actor: 'buyer', groupId, applicationId, target: 'cancelled' });
  }

  async executeChannelAction(input: { sellerId: string; aggregateType: string; aggregateId: string; action: string }) {
    if (input.aggregateType !== 'application') {
      throw new AppHttpError('Unsupported action aggregate', 400, 'ACTION_AGGREGATE_INVALID');
    }
    const target = input.action === 'accept_application'
      ? 'accepted'
      : input.action === 'reject_application' ? 'rejected' : null;
    if (!target) throw new AppHttpError('Unsupported channel action', 400, 'ACTION_INVALID');
    return this.transitionSeller(input.sellerId, input.aggregateId, target);
  }

  async getSellerHealth(sellerId: string) {
    const [channels, failedDeliveries] = await Promise.all([
      this.db.select({
        provider: channelConnections.provider,
        active: channelConnections.active,
        isPrimary: channelConnections.isPrimary,
      }).from(channelConnections).where(eq(channelConnections.sellerId, sellerId)),
      this.db.select({
        id: outboxEvents.id,
        applicationId: outboxEvents.aggregateId,
        eventType: outboxEvents.eventType,
        attemptCount: outboxEvents.attemptCount,
        lastError: outboxEvents.lastError,
        updatedAt: outboxEvents.updatedAt,
      }).from(outboxEvents)
        .innerJoin(sellerApplications, eq(outboxEvents.aggregateId, sellerApplications.id))
        .where(and(
          eq(sellerApplications.sellerId, sellerId),
          eq(outboxEvents.state, 'failed'),
        )).orderBy(desc(outboxEvents.updatedAt)),
    ]);
    return { channels, failedDeliveries };
  }

  async retryFailedDelivery(sellerId: string, eventId: string) {
    const [event] = await this.db.select({ id: outboxEvents.id })
      .from(outboxEvents)
      .innerJoin(sellerApplications, eq(outboxEvents.aggregateId, sellerApplications.id))
      .where(and(
        eq(outboxEvents.id, eventId),
        eq(outboxEvents.state, 'failed'),
        eq(sellerApplications.sellerId, sellerId),
      )).limit(1);
    if (!event) throw new AppHttpError('Failed delivery not found', 404, 'DELIVERY_FAILURE_NOT_FOUND');
    await this.db.update(outboxEvents).set({
      state: 'pending',
      retryCycle: sql`${outboxEvents.retryCycle} + 1`,
      availableAt: new Date(),
      lockedUntil: null,
      lockToken: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(outboxEvents.id, eventId));
  }

  private async transition(input: {
    actor: 'seller' | 'buyer';
    sellerId?: string;
    groupId?: string;
    applicationId: string;
    target: TargetStatus;
  }) {
    return this.db.transaction(async (transaction) => {
      const conditions = [eq(sellerApplications.id, input.applicationId)];
      if (input.sellerId) conditions.push(eq(sellerApplications.sellerId, input.sellerId));
      if (input.groupId) conditions.push(eq(sellerApplications.checkoutGroupId, input.groupId));
      const [current] = await transaction.select({
        application: sellerApplications,
        sellerStatus: sellers.status,
      }).from(sellerApplications)
        .innerJoin(sellers, eq(sellerApplications.sellerId, sellers.id))
        .where(and(...conditions)).for('update').limit(1);
      if (!current) throw new AppHttpError('Application not found', 404, 'APPLICATION_NOT_FOUND');
      if (input.actor === 'seller' && current.sellerStatus !== 'active') {
        throw new AppHttpError('Blocked seller cannot change applications', 403, 'SELLER_BLOCKED');
      }
      if (current.application.status === input.target) {
        return { id: current.application.id, status: current.application.status, changed: false };
      }
      const allowed = input.actor === 'buyer'
        ? current.application.status === 'new' && input.target === 'cancelled'
        : (current.application.status === 'new' && ['accepted', 'rejected'].includes(input.target))
          || (current.application.status === 'accepted' && input.target === 'completed');
      if (!allowed) {
        throw new AppHttpError('Application transition is not allowed', 409, 'APPLICATION_TRANSITION_INVALID', {
          currentStatus: current.application.status,
        });
      }
      const [updated] = await transaction.update(sellerApplications)
        .set({ status: input.target, updatedAt: new Date() })
        .where(and(
          eq(sellerApplications.id, input.applicationId),
          eq(sellerApplications.status, current.application.status),
        )).returning({ id: sellerApplications.id, status: sellerApplications.status });
      if (!updated) throw new AppHttpError('Application changed concurrently', 409, 'APPLICATION_TRANSITION_CONFLICT');
      await transaction.insert(auditEvents).values({
        actorKind: input.actor,
        actorId: input.actor === 'seller' ? current.application.sellerId : null,
        aggregateType: 'application', aggregateId: input.applicationId,
        action: `application.${input.target}`, metadata: {},
      });
      if (input.actor === 'buyer') {
        await transaction.insert(outboxEvents).values({
          aggregateType: 'application', aggregateId: input.applicationId,
          eventType: 'application.cancelled_by_buyer',
          idempotencyKey: `application:${input.applicationId}:cancelled:seller`,
        });
      } else {
        await transaction.insert(outboxEvents).values([
          {
            aggregateType: 'application', aggregateId: input.applicationId,
            eventType: `application.${input.target}`,
            idempotencyKey: `application:${input.applicationId}:${input.target}:buyer`,
          },
          {
            aggregateType: 'application', aggregateId: input.applicationId,
            eventType: 'application.seller_status_changed',
            idempotencyKey: `application:${input.applicationId}:${input.target}:seller`,
          },
        ]);
      }
      return { ...updated, changed: true };
    });
  }
}
