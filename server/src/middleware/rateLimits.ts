import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import type { AppEnv } from '../config/env';
import { SESSION_COOKIE } from '../auth/middleware';

function limiter(config: AppEnv, limit: number, useSession = false) {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MINUTES * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (request) => {
      const session = useSession ? request.cookies?.[SESSION_COOKIE] : undefined;
      if (typeof session === 'string') {
        return `session:${createHash('sha256').update(session).digest('hex')}`;
      }
      return request.ip ? `ip:${ipKeyGenerator(request.ip)}` : 'ip:unknown';
    },
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests; try again later' },
  });
}

export function createRateLimiters(config: AppEnv) {
  return {
    auth: limiter(config, config.RATE_LIMIT_AUTH_MAX),
    link: limiter(config, config.RATE_LIMIT_LINK_MAX),
    sellerLink: limiter(config, config.RATE_LIMIT_LINK_MAX, true),
    upload: limiter(config, config.RATE_LIMIT_UPLOAD_MAX, true),
    checkout: limiter(config, config.RATE_LIMIT_CHECKOUT_MAX),
    tracking: limiter(config, config.RATE_LIMIT_TRACKING_MAX),
    action: limiter(config, config.RATE_LIMIT_ACTION_MAX),
    sellerAction: limiter(config, config.RATE_LIMIT_ACTION_MAX, true),
  };
}
