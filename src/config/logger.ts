import { pino } from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.isTest ? 'silent' : env.isProd ? 'info' : 'debug'),
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } } }
    : {}),
});
