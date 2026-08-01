import { describe, expect, it, vi } from 'vitest';
import { TelegramChannelAdapter, type TelegramTransport } from './telegram';

describe('TelegramChannelAdapter contract', () => {
  it('creates a deep link and decodes start without exposing domain IDs', () => {
    const adapter = new TelegramChannelAdapter('token', '@hutorynok_bot', { sendMessage: vi.fn() });
    const opaque = 'abcdefghijklmnop123456';

    expect(adapter.createLinkUrl(opaque)).toBe(`https://t.me/hutorynok_bot?start=${opaque}`);
    expect(adapter.decodeUpdate({ message: { text: `/start ${opaque}`, chat: { id: 12345 } } })).toEqual({
      kind: 'link_confirmation', providerToken: opaque, destination: '12345',
    });
    expect(adapter.decodeUpdate({ message: { text: '/start seller-id', chat: { id: 12345 } } })).toBeNull();
  });

  it('normalizes callback actions and sends opaque inline tokens', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
    const answerCallbackQuery = vi.fn().mockResolvedValue(true);
    const adapter = new TelegramChannelAdapter('token', 'hutorynok_bot', {
      sendMessage, answerCallbackQuery,
    } as TelegramTransport);
    const token = 'abcdefghijklmnop123456';

    expect(adapter.decodeUpdate({
      callback_query: { id: 'callback-1', data: `act:${token}`, message: { chat: { id: -99 } } },
    })).toEqual({ kind: 'action', actionToken: token, destination: '-99', callbackId: 'callback-1' });

    await adapter.send('42', { text: 'Нова заявка', actions: [{ label: 'Прийняти', token }] }, 'event-1');
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0][2].reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'Прийняти', callback_data: `act:${token}`,
    });
    await adapter.acknowledgeAction('callback-1', 'Дію прийнято');
    expect(answerCallbackQuery).toHaveBeenCalledWith('callback-1', { text: 'Дію прийнято' });
  });
});
