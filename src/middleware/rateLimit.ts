import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

/** Brute-force protection for sign-in: only failed attempts count. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many sign-in attempts. Try again in 15 minutes.',
    },
  },
});

/** General API ceiling per client. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Slow down.' } },
});
