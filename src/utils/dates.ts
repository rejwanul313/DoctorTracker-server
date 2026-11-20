const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → Date at 00:00 UTC. Calendar dates are stored as UTC midnight. */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Inclusive date range filter for a `YYYY-MM-DD` from/to pair (to is inclusive → `< to + 1 day`). */
export function dateRange(from?: string, to?: string): { $gte?: Date; $lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lt?: Date } = {};
  if (from) range.$gte = parseIsoDate(from);
  if (to) range.$lt = new Date(parseIsoDate(to).getTime() + DAY_MS);
  return range;
}

export function startOfMonthUTC(date: Date, offsetMonths = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

/** `YYYY-MM` keys for the last `count` months (oldest first), ending with the current month. */
export function lastMonths(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = startOfMonthUTC(now, i - (count - 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
