import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  applicationItems,
  channelConnections,
  checkoutGroups,
  sellerApplications,
  sellers,
} from '../db/schema';
import { AppHttpError } from '../http/errors';
import { decryptString } from '../security/crypto';
import type { ChannelActionTokenService } from './actionTokenService';
import type { MessagingChannelRegistry } from './registry';

const money = (kopecks: number) => `${(kopecks / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴`;

export class ChannelNotificationService {
  constructor(
    private readonly db: Database,
    private readonly registry: MessagingChannelRegistry,
    private readonly actions: ChannelActionTokenService,
    private readonly encryptionKey: string,
  ) {}

  async sendApplicationEvent(applicationId: string, eventType: string, idempotencyKey: string) {
    const [application] = await this.db.select({
      id: sellerApplications.id,
      sellerId: sellerApplications.sellerId,
      checkoutGroupId: sellerApplications.checkoutGroupId,
      status: sellerApplications.status,
      amountKopecks: sellerApplications.amountKopecks,
      storeName: sellers.storeName,
    }).from(sellerApplications)
      .innerJoin(sellers, eq(sellerApplications.sellerId, sellers.id))
      .where(eq(sellerApplications.id, applicationId)).limit(1);
    if (!application) throw new AppHttpError('Application not found', 404, 'APPLICATION_NOT_FOUND');

    if (eventType === 'application.created' || eventType === 'application.cancelled_by_buyer') {
      const [connection] = await this.db.select().from(channelConnections).where(and(
        eq(channelConnections.sellerId, application.sellerId),
        eq(channelConnections.active, true),
        eq(channelConnections.isPrimary, true),
      )).limit(1);
      if (!connection) throw new AppHttpError('Seller channel unavailable', 409, 'CHANNEL_UNAVAILABLE');
      if (eventType === 'application.cancelled_by_buyer') {
        await this.registry.require(connection.provider).send(
          decryptString(connection.destinationEncrypted, this.encryptionKey),
          { text: `Покупець скасував заявку для «${application.storeName}» на ${money(application.amountKopecks)}.` },
          idempotencyKey,
        );
        return;
      }
      const items = await this.db.select().from(applicationItems)
        .where(eq(applicationItems.applicationId, application.id)).orderBy(asc(applicationItems.id));
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
      const [acceptToken, rejectToken] = await Promise.all([
        this.actions.create({
          provider: connection.provider, sellerId: application.sellerId,
          destinationFingerprint: connection.destinationFingerprint,
          aggregateType: 'application', aggregateId: application.id,
          action: 'accept_application', expiresAt,
          idempotencyKey: `${idempotencyKey}:accept`,
        }),
        this.actions.create({
          provider: connection.provider, sellerId: application.sellerId,
          destinationFingerprint: connection.destinationFingerprint,
          aggregateType: 'application', aggregateId: application.id,
          action: 'reject_application', expiresAt,
          idempotencyKey: `${idempotencyKey}:reject`,
        }),
      ]);
      const lines = items.map((item) => `• ${item.productName} × ${item.quantity} — ${money(item.lineTotalKopecks)}`);
      await this.registry.require(connection.provider).send(
        decryptString(connection.destinationEncrypted, this.encryptionKey),
        {
          text: [`Нова заявка для «${application.storeName}»`, ...lines, `Разом: ${money(application.amountKopecks)}`].join('\n'),
          actions: [
            { label: 'Прийняти', token: acceptToken },
            { label: 'Відхилити', token: rejectToken },
          ],
        },
        idempotencyKey,
      );
      return;
    }

    const [group] = await this.db.select().from(checkoutGroups)
      .where(eq(checkoutGroups.id, application.checkoutGroupId)).limit(1);
    if (!group) throw new AppHttpError('Checkout group not found', 404, 'CHECKOUT_GROUP_NOT_FOUND');
    const labels: Record<string, string> = {
      'application.accepted': 'прийнята',
      'application.rejected': 'відхилена',
      'application.cancelled': 'скасована',
      'application.completed': 'виконана',
    };
    const label = labels[eventType];
    if (!label) throw new Error(`Unsupported application notification ${eventType}`);
    await this.registry.require(group.buyerChannelProvider).send(
      decryptString(group.buyerChannelDestinationEncrypted, this.encryptionKey),
      { text: `Заявка до «${application.storeName}» ${label}. Сума: ${money(application.amountKopecks)}.` },
      idempotencyKey,
    );
  }

  async sendCheckoutSummary(groupId: string, idempotencyKey: string) {
    const [group] = await this.db.select().from(checkoutGroups).where(eq(checkoutGroups.id, groupId)).limit(1);
    if (!group) throw new AppHttpError('Checkout group not found', 404, 'CHECKOUT_GROUP_NOT_FOUND');
    const applications = await this.db.select({
      storeName: sellers.storeName,
      amountKopecks: sellerApplications.amountKopecks,
    }).from(sellerApplications)
      .innerJoin(sellers, eq(sellerApplications.sellerId, sellers.id))
      .where(eq(sellerApplications.checkoutGroupId, groupId));
    const lines = applications.map((application) => `• ${application.storeName}: ${money(application.amountKopecks)}`);
    await this.registry.require(group.buyerChannelProvider).send(
      decryptString(group.buyerChannelDestinationEncrypted, this.encryptionKey),
      { text: ['Заявки оформлено', ...lines, 'Статуси кожного продавця надходитимуть окремо.'].join('\n') },
      idempotencyKey,
    );
  }
}
