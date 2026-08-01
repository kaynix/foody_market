import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../config/env';
import { errorHandler } from '../middleware/errorHandler';
import { MessagingChannelRegistry } from './registry';
import { createPublicMessagingRouter } from './routes';
import type { MessagingChannelAdapter } from './types';
import type { MessagingUpdateService } from './updateService';

const adapter: MessagingChannelAdapter = {
  metadata: { provider: 'telegram', displayName: 'Telegram', supportsActions: true, supportsDeepLinks: true },
  createLinkUrl: (token) => `https://t.me/test?start=${token}`,
  decodeUpdate: () => null,
  send: vi.fn(),
};

describe('Telegram webhook boundary', () => {
  afterEach(() => vi.restoreAllMocks());
  it('rejects a wrong bot secret before processing the update', async () => {
    const config = parseEnv({
      NODE_ENV: 'development', DATABASE_URL: 'postgresql:///test',
      SESSION_SECRET: 'a'.repeat(32), PII_ENCRYPTION_KEY: '1'.repeat(64),
      TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_BOT_USERNAME: 'test_bot',
      TELEGRAM_WEBHOOK_SECRET: 'expected-secret',
    });
    const updates = { handle: vi.fn() } as unknown as MessagingUpdateService;
    const app = express();
    app.use(express.json());
    app.use('/api/messaging', createPublicMessagingRouter(
      config, new MessagingChannelRegistry([adapter]), updates,
    ));
    app.use(errorHandler);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await request(app).post('/api/messaging/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', 'wrong-secret')
      .send({ update_id: 1 })
      .expect(401);
    expect(updates.handle).not.toHaveBeenCalled();

    await request(app).post('/api/messaging/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', 'expected-secret')
      .send({ update_id: 2 })
      .expect(200);
    expect(updates.handle).toHaveBeenCalledWith('telegram', { update_id: 2 });
  });
});
