import { Router, type CookieOptions, type Request } from 'express';
import { z } from 'zod';
import type { AppEnv } from '../config/env';
import { AuthError } from './errors';
import {
  CSRF_COOKIE,
  IDENTITY_STATE_COOKIE,
  requireCsrf,
  requireSeller,
  SESSION_COOKIE,
} from './middleware';
import type { IdentityProviderRegistry } from './registry';
import type { SellerSessionService } from './sessionService';
import { createSignedToken, safeTokenEqual, verifySignedToken } from './tokens';

const callbackSchema = z.object({
  state: z.string().min(1),
  accountId: z.string().optional(),
});

interface AuthRouterDependencies {
  config: AppEnv;
  registry: IdentityProviderRegistry;
  sessionService: SellerSessionService;
}

function cookieOptions(config: AppEnv): CookieOptions {
  return {
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
  };
}

function currentSessionToken(request: Request): string | undefined {
  const token = request.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' ? token : undefined;
}

export function createAuthRouter({
  config,
  registry,
  sessionService,
}: AuthRouterDependencies): Router {
  const router = Router();
  const baseCookieOptions = cookieOptions(config);

  router.get('/providers', (_request, response) => {
    response.json({ providers: registry.list() });
  });

  router.post('/:provider/start', async (request, response, next) => {
    try {
      const provider = registry.get(request.params.provider);
      const start = await provider.begin();
      const stateExpiresAt = new Date(
        Date.now() + config.IDENTITY_STATE_TTL_MINUTES * 60 * 1000,
      );
      const state = createSignedToken(config.SESSION_SECRET, stateExpiresAt);

      response.cookie(IDENTITY_STATE_COOKIE, state, {
        ...baseCookieOptions,
        httpOnly: true,
        maxAge: config.IDENTITY_STATE_TTL_MINUTES * 60 * 1000,
      });
      response.json({ provider: provider.name, state, ...start });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:provider/callback', async (request, response, next) => {
    try {
      const body = callbackSchema.safeParse(request.body);
      if (!body.success) {
        throw new AuthError('Invalid identity callback', 400, 'IDENTITY_CALLBACK_INVALID');
      }

      const cookieState = request.cookies?.[IDENTITY_STATE_COOKIE];
      if (
        typeof cookieState !== 'string' ||
        !safeTokenEqual(cookieState, body.data.state) ||
        !verifySignedToken(cookieState, config.SESSION_SECRET)
      ) {
        throw new AuthError('Invalid identity state', 403, 'IDENTITY_STATE_INVALID');
      }

      const provider = registry.get(request.params.provider);
      const identity = await provider.complete({ accountId: body.data.accountId });
      const session = await sessionService.create(identity, currentSessionToken(request));
      const csrfToken = createSignedToken(config.SESSION_SECRET, session.expiresAt);

      response.clearCookie(IDENTITY_STATE_COOKIE, {
        ...baseCookieOptions,
        httpOnly: true,
      });
      response.cookie(SESSION_COOKIE, session.rawToken, {
        ...baseCookieOptions,
        httpOnly: true,
        expires: session.expiresAt,
      });
      response.cookie(CSRF_COOKIE, csrfToken, {
        ...baseCookieOptions,
        httpOnly: false,
        expires: session.expiresAt,
      });
      response.json({ seller: session.seller, csrfToken });
    } catch (error) {
      next(error);
    }
  });

  router.get('/session', requireSeller(sessionService), (request, response) => {
    response.json({ seller: request.seller });
  });

  router.post(
    '/logout',
    requireSeller(sessionService),
    requireCsrf(config.SESSION_SECRET),
    async (request, response, next) => {
      try {
        const rawToken = currentSessionToken(request);
        if (rawToken) await sessionService.revoke(rawToken);

        response.clearCookie(SESSION_COOKIE, { ...baseCookieOptions, httpOnly: true });
        response.clearCookie(CSRF_COOKIE, { ...baseCookieOptions, httpOnly: false });
        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
