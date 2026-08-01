import { Router } from 'express';
import { z } from 'zod';
import { requireCsrf, requireSeller } from '../auth/middleware';
import type { SellerSessionService } from '../auth/sessionService';
import type { AppEnv } from '../config/env';
import { AppHttpError } from '../http/errors';
import { safeTokenEqual } from '../auth/tokens';
import type { ChannelLinkIntentService } from './linkIntentService';
import type { MessagingChannelRegistry } from './registry';
import type { MessagingUpdateService } from './updateService';

const providerSchema = z.string().trim().min(1).max(40);

function parseProvider(value: unknown) {
  const parsed = providerSchema.safeParse(value);
  if (!parsed.success) throw new AppHttpError('Invalid provider', 400, 'VALIDATION_ERROR');
  return parsed.data;
}

export function createPublicMessagingRouter(
  config: AppEnv,
  registry: MessagingChannelRegistry,
  updates: MessagingUpdateService,
) {
  const router = Router();
  router.get('/providers', (_request, response) => {
    response.json({ providers: registry.list(), defaultProvider: registry.defaultProvider() });
  });
  router.post('/link-intents', async (request, response, next) => {
    try {
      const parsed = z.object({ provider: providerSchema }).safeParse(request.body);
      if (!parsed.success) throw new AppHttpError('Invalid provider', 400, 'VALIDATION_ERROR');
      response.status(201).json(await updates.createBuyerIntent(parsed.data.provider));
    } catch (error) { next(error); }
  });
  router.get('/link-intents/status', async (request, response, next) => {
    try {
      const secret = request.get('x-link-secret');
      if (!secret) throw new AppHttpError('Link secret is required', 400, 'LINK_SECRET_REQUIRED');
      response.json(await updates.getBuyerIntent(secret));
    } catch (error) { next(error); }
  });
  router.post('/telegram/webhook', async (request, response, next) => {
    try {
      const supplied = request.get('x-telegram-bot-api-secret-token');
      if (!config.TELEGRAM_WEBHOOK_SECRET || !supplied || !safeTokenEqual(supplied, config.TELEGRAM_WEBHOOK_SECRET)) {
        throw new AppHttpError('Invalid Telegram webhook secret', 401, 'TELEGRAM_WEBHOOK_INVALID');
      }
      if (!registry.get('telegram')) {
        throw new AppHttpError('Telegram provider is unavailable', 503, 'CHANNEL_UNAVAILABLE');
      }
      await updates.handle('telegram', request.body);
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createSellerChannelRouter(
  config: AppEnv,
  sessions: SellerSessionService,
  registry: MessagingChannelRegistry,
  links: ChannelLinkIntentService,
) {
  const router = Router();
  router.use(requireSeller(sessions));
  router.get('/', async (request, response, next) => {
    try {
      response.json({
        connections: await links.listSellerConnections(request.seller!.id),
        providers: registry.list(),
        defaultProvider: registry.defaultProvider(),
      });
    } catch (error) { next(error); }
  });
  router.post('/link-intents', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const parsed = z.object({ provider: providerSchema }).safeParse(request.body);
      if (!parsed.success) throw new AppHttpError('Invalid provider', 400, 'VALIDATION_ERROR');
      response.status(201).json(await links.createSellerIntent(request.seller!.id, parsed.data.provider));
    } catch (error) { next(error); }
  });
  router.get('/link-intents/status', async (request, response, next) => {
    try {
      const secret = request.get('x-link-secret');
      if (!secret) throw new AppHttpError('Link secret is required', 400, 'LINK_SECRET_REQUIRED');
      response.json(await links.getSellerIntent(request.seller!.id, secret));
    } catch (error) { next(error); }
  });
  router.patch('/:provider/primary', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const provider = parseProvider(request.params.provider);
      response.json({ connections: await links.setPrimary(request.seller!.id, provider) });
    } catch (error) { next(error); }
  });
  router.delete('/:provider', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const provider = parseProvider(request.params.provider);
      await links.disconnect(request.seller!.id, provider);
      response.status(204).send();
    } catch (error) { next(error); }
  });
  return router;
}
