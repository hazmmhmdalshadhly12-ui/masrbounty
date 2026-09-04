// In-memory sliding-window rate limiter (per server instance).
// For multi-instance production, replace store with Redis/Upstash (same interface).

interface Entry {
  hits: number[];
}

const store = new Map<string, Entry>();

function prune(hits: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  while (hits.length && (hits[0] as number) <= cutoff) hits.shift();
  return hits;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, max = 20, windowMs = 60_000, now = Date.now()): RateLimitResult {
  let entry = store.get(key);
  if (!entry) {
    entry = { hits: [] };
    store.set(key, entry);
  }
  prune(entry.hits, windowMs, now);
  if (entry.hits.length >= max) {
    const oldest = entry.hits[0] as number;
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  entry.hits.push(now);
  return { ok: true, remaining: max - entry.hits.length, retryAfterSec: 0 };
}

/** Throws a 429-style error when the limit is exceeded. Use at the top of Server Actions / API routes. */
export function enforceRate(key: string, max = 20, windowMs = 60_000): void {
  const r = rateLimit(key, max, windowMs);
  if (!r.ok) {
    const err = new Error(`Too many requests. Retry in ${r.retryAfterSec}s.`) as Error & {
      status: number;
      retryAfterSec: number;
    };
    err.status = 429;
    err.retryAfterSec = r.retryAfterSec;
    throw err;
  }
}

export const limits = {
  login: { max: 5, windowMs: 60_000 },
  register: { max: 5, windowMs: 300_000 },
  reportCreate: { max: 10, windowMs: 3_600_000 },
  message: { max: 30, windowMs: 60_000 },
  comment: { max: 30, windowMs: 60_000 },
  dispute: { max: 5, windowMs: 3_600_000 },
  payout: { max: 5, windowMs: 3_600_000 },
  api: { max: 60, windowMs: 60_000 },
} as const;
