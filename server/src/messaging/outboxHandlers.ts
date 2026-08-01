import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { productImages } from '../db/schema';
import type { FileStorageAdapter } from '../storage/types';
import type { ChannelNotificationService } from './notificationService';
import type { OutboxWorker } from './outboxWorker';
import { PermanentChannelError } from './types';

function imageVariantKeys(mediumKey: string) {
  if (!mediumKey.endsWith('-medium.webp')) return [mediumKey];
  return [
    mediumKey.replace(/-medium\.webp$/, '-thumbnail.webp'),
    mediumKey,
    mediumKey.replace(/-medium\.webp$/, '-large.webp'),
  ];
}

export function registerOutboxHandlers(
  worker: OutboxWorker,
  db: Database,
  storage: FileStorageAdapter,
  notifications: ChannelNotificationService,
) {
  worker.register('storage.cleanup_requested', async (event) => {
    if (event.aggregateType !== 'product') throw new PermanentChannelError('Unsupported storage aggregate');
    const images = await db.select().from(productImages).where(eq(productImages.productId, event.aggregateId));
    for (const image of images) {
      for (const key of imageVariantKeys(image.storageKey)) await storage.delete(key);
    }
    await db.delete(productImages).where(eq(productImages.productId, event.aggregateId));
  });
  worker.register('checkout.created', (event, key) => notifications.sendCheckoutSummary(event.aggregateId, key));
  for (const eventType of [
    'application.created',
    'application.accepted',
    'application.rejected',
    'application.cancelled',
    'application.completed',
  ]) {
    worker.register(eventType, (event, key) => notifications.sendApplicationEvent(event.aggregateId, eventType, key));
  }
  return worker;
}
