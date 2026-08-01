import { env } from '../config/env';
import { database } from '../db/client';
import { ChannelActionTokenService } from '../messaging/actionTokenService';
import { ChannelNotificationService } from '../messaging/notificationService';
import { registerOutboxHandlers } from '../messaging/outboxHandlers';
import { OutboxWorker } from '../messaging/outboxWorker';
import { createMessagingRegistry } from '../messaging/registry';
import { createFileStorage } from '../storage/registry';

const registry = createMessagingRegistry(env);
const actions = new ChannelActionTokenService(database.db, env.SESSION_SECRET);
const notifications = new ChannelNotificationService(database.db, registry, actions, env.PII_ENCRYPTION_KEY);
const worker = registerOutboxHandlers(
  new OutboxWorker(database.db, {
    batchSize: env.OUTBOX_BATCH_SIZE,
    leaseSeconds: env.OUTBOX_LEASE_SECONDS,
    maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
  }),
  database.db,
  createFileStorage(env),
  notifications,
);

let stopping = false;
const stop = () => { stopping = true; };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function run() {
  while (!stopping) {
    try {
      const processed = await worker.runBatch();
      if (processed === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Outbox batch failed:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  await database.pool.end();
}

run().catch((error) => {
  console.error('Outbox worker stopped:', error);
  process.exitCode = 1;
});
