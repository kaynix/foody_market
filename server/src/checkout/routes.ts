import { Router } from 'express';
import { z } from 'zod';
import { AppHttpError } from '../http/errors';
import type { CheckoutService } from './service';
import { checkoutCreateSchema, checkoutLinesSchema } from './validation';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppHttpError(z.prettifyError(parsed.error), 400, 'VALIDATION_ERROR');
  return parsed.data;
}

function trackingToken(request: { get(name: string): string | undefined }) {
  const token = request.get('x-tracking-token');
  if (!token) throw new AppHttpError('Tracking token is required', 401, 'TRACKING_TOKEN_REQUIRED');
  return token;
}

export function createCheckoutRouter(service: CheckoutService) {
  const router = Router();
  router.post('/validate', async (request, response, next) => {
    try {
      const { lines } = parse(checkoutLinesSchema, request.body);
      response.json(await service.validate(lines));
    } catch (error) { next(error); }
  });
  router.post('/', async (request, response, next) => {
    try {
      response.status(201).json(await service.create(parse(checkoutCreateSchema, request.body)));
    } catch (error) { next(error); }
  });
  return router;
}

export function createTrackingRouter(service: CheckoutService) {
  const router = Router();
  router.get('/:groupId', async (request, response, next) => {
    try {
      response.json(await service.getTracking(
        parse(z.string().uuid(), request.params.groupId), trackingToken(request),
      ));
    } catch (error) { next(error); }
  });
  router.post('/:groupId/applications/:applicationId/cancel', async (request, response, next) => {
    try {
      response.json(await service.cancel(
        parse(z.string().uuid(), request.params.groupId),
        parse(z.string().uuid(), request.params.applicationId),
        trackingToken(request),
      ));
    } catch (error) { next(error); }
  });
  return router;
}
