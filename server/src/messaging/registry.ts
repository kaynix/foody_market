import type { AppEnv } from '../config/env';
import { TelegramChannelAdapter } from './telegram';
import type { MessagingChannelAdapter } from './types';

export class MessagingChannelRegistry {
  private readonly byProvider: Map<string, MessagingChannelAdapter>;

  constructor(adapters: MessagingChannelAdapter[]) {
    this.byProvider = new Map(adapters.map((adapter) => [adapter.metadata.provider, adapter]));
  }

  list() {
    return [...this.byProvider.values()].map((adapter) => adapter.metadata);
  }

  get(provider: string): MessagingChannelAdapter | undefined {
    return this.byProvider.get(provider);
  }

  require(provider: string): MessagingChannelAdapter {
    const adapter = this.get(provider);
    if (!adapter) throw new Error(`Messaging provider ${provider} is unavailable`);
    return adapter;
  }

  defaultProvider(): string | null {
    if (this.byProvider.has('telegram')) return 'telegram';
    return this.byProvider.keys().next().value ?? null;
  }
}

export function createMessagingRegistry(config: AppEnv): MessagingChannelRegistry {
  const adapters: MessagingChannelAdapter[] = [];
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_BOT_USERNAME) {
    adapters.push(new TelegramChannelAdapter(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_BOT_USERNAME));
  }
  return new MessagingChannelRegistry(adapters);
}
