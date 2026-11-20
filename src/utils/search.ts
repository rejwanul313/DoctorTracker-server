/**
 * Prefix search on an indexed multikey array (`searchTokens`).
 *
 * Why: `$text` only matches whole words (typing "farh" finds nothing) and an unanchored or
 * case-insensitive regex cannot use an index efficiently. Instead each document stores a small
 * array of lower-cased tokens and the query uses *anchored* regexes (`^term`), which MongoDB
 * turns into a tight index range scan on `{ searchTokens: 1 }`.
 */

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;
const PHONE_LIKE = /^[\d\s+()-]+$/;

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return [];
  const variants = new Set([digits]);
  // Local format: +880 1711-204518 is dialled as 01711204518.
  if (digits.startsWith('880')) variants.add(`0${digits.slice(3)}`);
  if (digits.length > 10) variants.add(digits.slice(-10));
  return [...variants];
}

export function buildSearchTokens(input: {
  name?: string;
  email?: string;
  phone?: string;
}): string[] {
  const tokens = new Set<string>();
  if (input.name) {
    for (const word of input.name.toLowerCase().split(WORD_SPLIT)) if (word) tokens.add(word);
  }
  if (input.email) {
    const email = input.email.toLowerCase();
    tokens.add(email);
    for (const part of email.split('@')[0]?.split(WORD_SPLIT) ?? []) if (part) tokens.add(part);
  }
  if (input.phone) for (const v of phoneVariants(input.phone)) tokens.add(v);
  return [...tokens];
}

/** Splits a user's search into normalized words. */
export function searchWords(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (PHONE_LIKE.test(q)) {
    const digits = q.replace(/\D/g, '');
    return digits ? [digits] : [];
  }
  const words: string[] = [];
  for (const raw of q.split(/\s+/)) {
    if (raw.includes('@')) words.push(raw);
    else words.push(...raw.split(WORD_SPLIT).filter(Boolean));
  }
  return words.slice(0, 5);
}

/** Every word must prefix-match some token: `{ searchTokens: { $all: [/^w1/, /^w2/] } }`. */
export function searchTokensFilter(query: string): { $all: RegExp[] } | undefined {
  const words = searchWords(query);
  if (words.length === 0) return undefined;
  return { $all: words.map((w) => new RegExp(`^${escapeRegex(w)}`)) };
}
