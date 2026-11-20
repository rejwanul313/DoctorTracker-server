import { Router } from 'express';
import { timelineQuerySchema } from '@dt/shared';
import { handler } from '../../utils/handler';
import { overview, timeline } from './stats.service';

export const statsRouter = Router();

statsRouter.get(
  '/overview',
  handler({}, async () => ({ data: await overview() })),
);

statsRouter.get(
  '/timeline',
  handler({ query: timelineQuerySchema }, async ({ query }) => ({
    data: await timeline(query.months),
  })),
);
