import { Bot } from 'grammy';
import { env } from '../config/env';
import { database } from '../db/client';
import { ChannelActionTokenService } from '../messaging/actionTokenService';
import { ChannelLinkIntentService } from '../messaging/linkIntentService';
import { createMessagingRegistry } from '../messaging/registry';
import { MessagingUpdateService } from '../messaging/updateService';
import { ApplicationService } from '../applications/service';

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

bot.on('message', (context) => updates.handle('telegram', context.update));
bot.on('callback_query:data', (context) => updates.handle('telegram', context.update));
bot.catch((error) => console.error('Telegram update failed:', error.error));

bot.start({
  onStart: () => console.log(`Telegram polling started for @${env.TELEGRAM_BOT_USERNAME}`),
}).catch((error) => {
  console.error('Telegram polling stopped:', error);
  process.exitCode = 1;
});
