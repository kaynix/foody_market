import { Router } from 'express';
import { z } from 'zod';
import { requireCsrf, requireSeller } from '../auth/middleware';
import type { SellerSessionService } from '../auth/sessionService';
import type { AppEnv } from '../config/env';
import { AppHttpError } from '../http/errors';
import type { ApplicationService } from './service';

const idSchema = z.string().uuid();
const transitionSchema = z.object({ status: z.enum(['accepted', 'rejected', 'completed']) });
const querySchema = z.object({
  status: z.enum(['new', 'accepted', 'rejected', 'cancelled', 'completed']).optional(),
  dateFrom: z.iso.datetime().transform((value) => new Date(value)).optional(),
  dateTo: z.iso.datetime().transform((value) => new Date(value)).optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppHttpError(z.prettifyError(parsed.error), 400, 'VALIDATION_ERROR');
  return parsed.data;
}

export function createSellerApplicationRouter(
  config: AppEnv,
  sessions: SellerSessionService,
  service: ApplicationService,
) {
  const router = Router();
  router.use(requireSeller(sessions));
  router.get('/', async (request, response, next) => {
    try {
      const filters = parse(querySchema, request.query);
      const [applications, health] = await Promise.all([
        service.listSeller(request.seller!.id, filters),
        service.getSellerHealth(request.seller!.id),
      ]);
      response.json({ applications, health });
    } catch (error) { next(error); }
  });
  router.get('/:applicationId', async (request, response, next) => {
    try {
      response.json(await service.getSellerDetail(
        request.seller!.id, parse(idSchema, request.params.applicationId),
      ));
    } catch (error) { next(error); }
  });
  router.patch('/:applicationId/status', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const { status } = parse(transitionSchema, request.body);
      response.json(await service.transitionSeller(
        request.seller!.id, parse(idSchema, request.params.applicationId), status,
      ));
    } catch (error) { next(error); }
  });
  router.post('/outbox/:eventId/retry', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      await service.retryFailedDelivery(request.seller!.id, parse(idSchema, request.params.eventId));
      response.status(202).json({ queued: true });
    } catch (error) { next(error); }
  });
  return router;
}
