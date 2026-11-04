/**
 * Pure date-range helpers for the admin analytics page. No Supabase imports,
 * fully unit-testable.
 */

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Parse the ?range= query param; anything invalid falls back to 30. */
export function parseAnalyticsRange(v: string | string[] | undefined | null): AnalyticsRange {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : NaN;
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : 30;
}

/** ISO day boundary (UTC) for the start of the day N days before `now`. */
function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export interface RangeWindow {
  /** Inclusive ISO lower bound (now − range days). */
  gte: string;
  /** Exclusive ISO upper bound (now). */
  lt: string;
  days: AnalyticsRange;
  /** `gte`/`lt` pairs for each day bucket, oldest first — for trend charts. */
  dayBuckets: Array<{ label: string; gte: string; lt: string }>;
}

/**
 * Build the query window + per-day buckets for trend charts. Buckets are
 * contiguous [gte, lt) day windows in UTC; label is the ISO date (YYYY-MM-DD).
 */
export function buildRangeWindow(range: AnalyticsRange, now: Date = new Date()): RangeWindow {
  const lt = now.toISOString();
  const gte = isoDaysAgo(now, range);
  const dayBuckets: RangeWindow['dayBuckets'] = [];
  for (let i = range - 1; i >= 0; i--) {
    const bGte = isoDaysAgo(now, i + 1);
    const bLt = isoDaysAgo(now, i);
    dayBuckets.push({ label: bGte.slice(0, 10), gte: bGte, lt: bLt });
  }
  return { gte, lt, days: range, dayBuckets };
}

/** Sum a numeric column across rows (string|number|null safe). */
export function sumNumeric(rows: Array<Record<string, unknown>>, key: string): number {
  return rows.reduce((acc, r) => {
    const v = r[key];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : NaN;
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
}

/** Count rows per enum value, including zero buckets for stable charts. */
export function countBy<T extends string>(rows: Array<Record<string, unknown>>, key: string, all: readonly T[]): Record<T, number> {
  const out = Object.fromEntries(all.map((k) => [k, 0])) as Record<T, number>;
  for (const r of rows) {
    const v = r[key];
    if (typeof v === 'string' && v in out) out[v as T] += 1;
  }
  return out;
}
