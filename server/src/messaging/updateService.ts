import type { ChannelActionTokenService } from './actionTokenService';
import { AppHttpError } from '../http/errors';
import type { ChannelLinkIntentService } from './linkIntentService';
import type { MessagingChannelRegistry } from './registry';

export class MessagingUpdateService {
  constructor(
    private readonly registry: MessagingChannelRegistry,
    private readonly links: ChannelLinkIntentService,
    private readonly actions: ChannelActionTokenService,
  ) {}

  async handle(provider: string, update: unknown) {
    const adapter = this.registry.require(provider);
    const decoded = adapter.decodeUpdate(update);
    if (!decoded) return { handled: false as const };
    if (decoded.kind === 'link_confirmation') {
      try {
        await this.links.confirm(provider, decoded.providerToken, decoded.destination);
      } catch (error) {
        if (!(error instanceof AppHttpError)) throw error;
        await adapter.send(decoded.destination, {
          text: 'Це посилання недійсне або вже використане. Створіть нове в кабінеті продавця.',
        }, 'invalid-link-confirmation');
        return { handled: true as const, kind: decoded.kind, valid: false as const };
      }
      await adapter.send(decoded.destination, {
        text: 'Канал підключено до Хуторинка. Тепер тут надходитимуть сповіщення.',
      }, 'link-confirmation');
      return { handled: true as const, kind: decoded.kind, valid: true as const };
    }
    let action;
    try {
      action = await this.actions.consume(provider, decoded.actionToken, decoded.destination);
    } catch (error) {
      if (!(error instanceof AppHttpError)) throw error;
      if (decoded.callbackId) await adapter.acknowledgeAction?.(decoded.callbackId, 'Дія недійсна або застаріла');
      return { handled: true as const, kind: decoded.kind, valid: false as const };
    }
    if (decoded.callbackId) {
      await adapter.acknowledgeAction?.(
        decoded.callbackId,
        action.alreadyConsumed ? 'Дію вже оброблено' : 'Дію прийнято',
      );
    }
    return { handled: true as const, kind: decoded.kind, valid: true as const, action };
  }
}
