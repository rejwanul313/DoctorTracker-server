import type { PageMeta } from '@dt/shared';

export function skipFor(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function pageMeta<F>(page: number, limit: number, total: number, facets?: F): PageMeta<F> {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    ...(facets ? { facets } : {}),
  } as PageMeta<F>;
}

/** Turns `[{ _id: 'Stable', n: 3 }, …]` into `{ Stable: 3, …, all: total }`. */
export function facetCounts<K extends string>(
  rows: { _id: K; n: number }[],
): Partial<Record<K, number>> & { all: number } {
  const out = { all: 0 } as Partial<Record<K, number>> & { all: number };
  for (const row of rows) {
    out[row._id] = row.n as never;
    out.all += row.n;
  }
  return out;
}
