import { AppError, ErrorCode } from "./response";

/**
 * Lightweight fixed-window rate limiter (in-process).
 *
 * This protects against burst abuse (e.g. hammering the sync or AI endpoints).
 * NOTE: an in-memory store is per-instance and resets on cold start, which is
 * fine for a single-region deployment / assignment scope. For a multi-instance
 * production deployment, swap the `store` for Upstash Redis or the Vercel KV
 * — the interface is intentionally tiny to make that a drop-in change. This
 * trade-off is documented in docs/security.md.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Opportunistic cleanup so the Map can't grow unbounded.
function sweep(now: number) {
  if (store.size < 10_000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitOptions {
  /** Unique bucket key, e.g. `sync:${ip}:${userId}`. */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `Too many requests. Retry in ${retryAfter}s.`,
      { retryAfter },
    );
  }
  bucket.count += 1;
}

/** Preset limits per endpoint class. */
export const RateLimits = {
  auth: { limit: 10, windowMs: 60_000 },
  sync: { limit: 120, windowMs: 60_000 },
  ai: { limit: 20, windowMs: 60_000 },
  mutation: { limit: 60, windowMs: 60_000 },
} as const;
