import { z } from 'zod';

export const timelineQuerySchema = z.object({
  months: z.coerce.number().int().min(3).max(24).default(12),
});
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
