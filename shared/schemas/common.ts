import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../enums';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Calendar date as sent over the wire: `YYYY-MM-DD`. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const email = z
  .string({ error: 'Enter an email address.' })
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address.');

export const phone = z
  .string({ error: 'Enter a phone number.' })
  .trim()
  .min(6, 'Enter a valid phone number.')
  .max(25, 'Enter a valid phone number.')
  .regex(/^\+?[\d\s\-()]+$/, 'Enter a valid phone number.');

export const personName = (label: string) =>
  z
    .string({ error: `Enter a ${label.toLowerCase()}.` })
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(80, `${label} must be at most 80 characters.`);

/** Optional trimmed search term; empty string becomes undefined. */
export const searchTerm = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export const idParams = z.object({ id: objectId });
