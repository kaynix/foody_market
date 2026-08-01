import { Bot, GrammyError, HttpError, InlineKeyboard, type Api, type RawApi } from 'grammy';
import { PermanentChannelError, type ChannelMessage, type DecodedChannelUpdate, type MessagingChannelAdapter } from './types';

export interface TelegramTransport {
  sendMessage(chatId: string, text: string, options?: Parameters<Api<RawApi>['sendMessage']>[2]): Promise<unknown>;
  answerCallbackQuery?(callbackId: string, options?: Parameters<Api<RawApi>['answerCallbackQuery']>[1]): Promise<unknown>;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

export class TelegramChannelAdapter implements MessagingChannelAdapter {
  readonly metadata = {
    provider: 'telegram',
    displayName: 'Telegram',
    supportsActions: true,
    supportsDeepLinks: true,
  } as const;
  private readonly transport: TelegramTransport;

  constructor(
    token: string,
    private readonly username: string,
    transport?: TelegramTransport,
  ) {
    const bot = transport ? null : new Bot(token);
    this.transport = transport ?? {
      sendMessage: (chatId, text, options) => bot!.api.sendMessage(chatId, text, options),
      answerCallbackQuery: (callbackId, options) => bot!.api.answerCallbackQuery(callbackId, options),
    };
  }

  createLinkUrl(providerToken: string): string {
    return `https://t.me/${this.username.replace(/^@/, '')}?start=${encodeURIComponent(providerToken)}`;
  }

  decodeUpdate(update: unknown): DecodedChannelUpdate | null {
    const root = readObject(update);
    const message = readObject(root?.message);
    const chat = readObject(message?.chat);
    if (typeof message?.text === 'string' && (typeof chat?.id === 'string' || typeof chat?.id === 'number')) {
      const match = message.text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})$/);
      if (match) return { kind: 'link_confirmation', providerToken: match[1], destination: String(chat.id) };
    }

    const callback = readObject(root?.callback_query);
    const callbackMessage = readObject(callback?.message);
    const callbackChat = readObject(callbackMessage?.chat);
    const callbackFrom = readObject(callback?.from);
    const destination = callbackChat?.id ?? callbackFrom?.id;
    if (
      typeof callback?.data === 'string'
      && callback.data.startsWith('act:')
      && (typeof destination === 'string' || typeof destination === 'number')
    ) {
      const actionToken = callback.data.slice(4);
      if (/^[A-Za-z0-9_-]{16,64}$/.test(actionToken)) {
        return {
          kind: 'action',
          actionToken,
          destination: String(destination),
          callbackId: typeof callback.id === 'string' ? callback.id : undefined,
        };
      }
    }
    return null;
  }

  async send(destination: string, message: ChannelMessage, _idempotencyKey: string): Promise<void> {
    const keyboard = message.actions?.length
      ? new InlineKeyboard(message.actions.map((action) => [{ text: action.label, callback_data: `act:${action.token}` }]))
      : undefined;
    try {
      await this.transport.sendMessage(destination, message.text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      if (error instanceof GrammyError && [400, 403].includes(error.error_code)) {
        throw new PermanentChannelError(error.description);
      }
      if (error instanceof HttpError) throw error;
      throw error;
    }
  }

  async acknowledgeAction(callbackId: string, text: string): Promise<void> {
    await this.transport.answerCallbackQuery?.(callbackId, { text });
  }
}
