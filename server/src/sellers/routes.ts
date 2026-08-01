import { Router } from 'express';
import { z } from 'zod';
import { requireCsrf, requireSeller } from '../auth/middleware';
import type { SellerSessionService } from '../auth/sessionService';
import type { AppEnv } from '../config/env';
import { AppHttpError } from '../http/errors';
import type { SellerProfileService } from './service';
import type { StorefrontService } from './storefrontService';
import {
  contactInputSchema,
  deliveryOptionInputSchema,
  onboardingInputSchema,
  profileUpdateSchema,
  slugSchema,
} from './validation';

const uuidParameter = z.string().uuid();

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppHttpError(z.prettifyError(result.error), 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

interface SellerRouterDependencies {
  config: AppEnv;
  sessionService: SellerSessionService;
  profileService: SellerProfileService;
}

export function createSellerRouter({
  config,
  sessionService,
  profileService,
}: SellerRouterDependencies): Router {
  const router = Router();
  router.use(requireSeller(sessionService));

  router.get('/profile', async (request, response, next) => {
    try {
      response.json(await profileService.getPrivateProfile(request.seller!.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/profile', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const input = parseInput(profileUpdateSchema, request.body);
      response.json({ profile: await profileService.updateProfile(request.seller!.id, input) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/contacts', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const input = parseInput(contactInputSchema, request.body);
      response.status(201).json({ contact: await profileService.createContact(request.seller!.id, input) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/contacts/:contactId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const contactId = parseInput(uuidParameter, request.params.contactId);
      const input = parseInput(contactInputSchema, request.body);
      response.json({ contact: await profileService.updateContact(request.seller!.id, contactId, input) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/contacts/:contactId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const contactId = parseInput(uuidParameter, request.params.contactId);
      await profileService.deleteContact(request.seller!.id, contactId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/delivery-options', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const input = parseInput(deliveryOptionInputSchema, request.body);
      response.status(201).json({
        deliveryOption: await profileService.createDeliveryOption(request.seller!.id, input),
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/delivery-options/:deliveryOptionId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const deliveryOptionId = parseInput(uuidParameter, request.params.deliveryOptionId);
      const input = parseInput(deliveryOptionInputSchema, request.body);
      response.json({
        deliveryOption: await profileService.updateDeliveryOption(
          request.seller!.id,
          deliveryOptionId,
          input,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/delivery-options/:deliveryOptionId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const deliveryOptionId = parseInput(uuidParameter, request.params.deliveryOptionId);
      await profileService.deleteDeliveryOption(request.seller!.id, deliveryOptionId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.put('/onboarding', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const input = parseInput(onboardingInputSchema, request.body);
      response.json(await profileService.completeOnboarding(request.seller!.id, input));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createStorefrontRouter(storefrontService: StorefrontService): Router {
  const router = Router();
  router.get('/:slug', async (request, response, next) => {
    try {
      const slug = parseInput(slugSchema, request.params.slug);
      response.json(await storefrontService.getPublicStorefront(slug));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
