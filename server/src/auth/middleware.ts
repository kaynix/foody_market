import type { NextFunction, Request, Response } from 'express';
import { AuthError } from './errors';
import type { SellerSessionService } from './sessionService';
import { safeTokenEqual, verifySignedToken } from './tokens';
import type { PublicSellerSession } from './types';

export const SESSION_COOKIE = 'hutorynok_seller_session';
export const CSRF_COOKIE = 'hutorynok_csrf';
export const IDENTITY_STATE_COOKIE = 'hutorynok_identity_state';

declare global {
  namespace Express {
    interface Request {
      seller?: PublicSellerSession;
    }
  }
}

export function requireSeller(sessionService: SellerSessionService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const rawToken = request.cookies?.[SESSION_COOKIE];
      if (typeof rawToken !== 'string') {
        throw new AuthError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }

      const seller = await sessionService.resolve(rawToken);
      if (!seller) {
        throw new AuthError('Session is invalid or expired', 401, 'SESSION_INVALID');
      }

      request.seller = seller;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCsrf(secret: string) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = request.get('x-csrf-token');

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      !safeTokenEqual(cookieToken, headerToken) ||
      !verifySignedToken(cookieToken, secret)
    ) {
      next(new AuthError('Invalid CSRF token', 403, 'CSRF_INVALID'));
      return;
    }

    next();
  };
}

export function requireSellerOwnership(parameter = 'sellerId') {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.seller) {
      next(new AuthError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    if (request.params[parameter] !== request.seller.id) {
      next(new AuthError('Seller resource is forbidden', 403, 'SELLER_FORBIDDEN'));
      return;
    }
    next();
  };
}
