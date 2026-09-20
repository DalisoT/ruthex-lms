/**
 * In-memory rate limiter.
 *
 * Per-process token bucket. For multi-instance deployment, swap for a Redis
 * or Upstash implementation — the API stays the same. Defaults are tuned for
 * the operational surface: 60 requests/minute for general traffic, 10/minute
 * for write/financial endpoints (login, repayment posting, applications).
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, Bucket>();

interface RateLimitOptions {
  /** Tokens per minute. */
  rpm: number;
  /** Bucket size (max burst). */
  burst?: number;
}

const buckets = new Map<string, RateLimitOptions>();
buckets.set('login', { rpm: 10, burst: 10 });
buckets.set('write', { rpm: 30, burst: 30 });
buckets.set('public', { rpm: 60, burst: 60 });
buckets.set('default', { rpm: 60, burst: 60 });

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Check + consume a token. Returns allowed=false when the bucket is empty.
 * In a serverless deployment, replace the Map with a durable store.
 */
export function consume(key: string, opts: RateLimitOptions = buckets.get('default')!): RateLimitResult {
  const now = Date.now();
  const refillRatePerMs = opts.rpm / 60_000;
  const burst = opts.burst ?? opts.rpm;
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { tokens: burst, lastRefill: now };
    store.set(key, bucket);
  }
  // Refill
  const elapsed = now - bucket.lastRefill;
  const refilled = bucket.tokens + elapsed * refillRatePerMs;
  bucket.tokens = Math.min(burst, refilled);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
  }
  const deficit = 1 - bucket.tokens;
  const retryAfterSec = Math.ceil(deficit / refillRatePerMs / 1000);
  return { allowed: false, remaining: 0, retryAfterSec };
}

export function rateLimitKeyFromRequest(req: Request, scope: string): string {
  // Use IP + scope. In production, also key by user id once authenticated.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return `${scope}:${ip}`;
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(result.retryAfterSec),
    },
  });
}
