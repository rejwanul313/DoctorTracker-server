import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@dt/shared';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export interface SessionPayload {
  sub: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: Role };
  }
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${env.SESSION_TTL_DAYS}d`,
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub) return null;
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch {
    return null;
  }
}

/** Every protected route: a valid, unexpired session cookie is required. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[env.COOKIE_NAME];
  const session = typeof token === 'string' ? verifySession(token) : null;
  if (!session) return next(ApiError.unauthorized());
  req.user = { id: session.sub, role: session.role };
  next();
};

/** Authorization: restricts a route to the given roles (use after `requireAuth`). */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
