import { Router, type CookieOptions } from 'express';
import { loginSchema } from '@dt/shared';
import { env } from '../../config/env';
import { requireAuth, signSession } from '../../middleware/auth';
import { loginLimiter } from '../../middleware/rateLimit';
import { handler } from '../../utils/handler';
import { getUser, verifyCredentials } from './auth.service';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/',
};

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  handler({ body: loginSchema }, async ({ body, res }) => {
    const user = await verifyCredentials(body);
    const token = signSession({ sub: user._id, role: user.role });
    res.cookie(env.COOKIE_NAME, token, { ...cookieOptions, maxAge: env.sessionTtlMs });
    return { data: user };
  }),
);

authRouter.post(
  '/logout',
  handler({}, ({ res }) => {
    res.clearCookie(env.COOKIE_NAME, cookieOptions);
    return undefined;
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  handler({}, async ({ req }) => ({ data: await getUser(req.user!.id) })),
);
