import { Bot } from 'grammy';
import { env } from '../config/env';
import { database } from '../db/client';
import { ChannelActionTokenService } from '../messaging/actionTokenService';
import { ChannelLinkIntentService } from '../messaging/linkIntentService';
import { createMessagingRegistry } from '../messaging/registry';
import { MessagingUpdateService } from '../messaging/updateService';
import { ApplicationService } from '../applications/service';
import { HeartbeatService } from '../maintenance/heartbeatService';
import { safeErrorForLog } from '../security/redaction';

if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
  throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME are required for polling');
}
if (env.NODE_ENV === 'production') {
  throw new Error('Telegram long polling is development-only; configure the webhook in production');
}

const registry = createMessagingRegistry(env);
const links = new ChannelLinkIntentService(
  database.db,
  registry,
  env.SESSION_SECRET,
  env.PII_ENCRYPTION_KEY,
  env.CHANNEL_LINK_TTL_MINUTES,
);
const actions = new ChannelActionTokenService(database.db, env.SESSION_SECRET);
const applications = new ApplicationService(database.db, env.PII_ENCRYPTION_KEY);
const updates = new MessagingUpdateService(registry, links, actions, applications);
const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const heartbeat = new HeartbeatService(database.db, 'telegram-polling');

bot.on('message', async (context) => {
  await updates.handle('telegram', context.update);
  await heartbeat.beat({ mode: 'polling' });
});
bot.on('callback_query:data', async (context) => {
  await updates.handle('telegram', context.update);
  await heartbeat.beat({ mode: 'polling' });
});
bot.catch((error) => console.error('Telegram update failed:', safeErrorForLog(error.error)));

bot.start({
  onStart: async () => {
    await heartbeat.beat({ mode: 'polling' }, true);
    console.log(`Telegram polling started for @${env.TELEGRAM_BOT_USERNAME}`);
  },
}).catch((error) => {
  console.error('Telegram polling stopped:', safeErrorForLog(error));
  process.exitCode = 1;
});
