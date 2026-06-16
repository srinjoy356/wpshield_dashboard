/**
 * Rate limiting — in-memory via rate-limiter-flexible.
 *
 * No external service required (unlike the previous Upstash-backed version) — this
 * runs entirely inside the Node process, so there's nothing new to provision and no
 * new env vars.
 *
 * Trade-off worth knowing: if this app ever runs as more than one instance/process at
 * once (scaling to multiple Render instances, a serverless deployment with several
 * concurrent isolates, etc.), each instance keeps its own independent counters. A limit
 * of "5 per 10 minutes" effectively becomes "5 per 10 minutes, per instance" — someone
 * hitting different instances behind a load balancer could exceed the intended global
 * limit. For a single-instance deployment (the common case for an app this size) that
 * doesn't matter at all. If you do scale out later, rate-limiter-flexible ships
 * matching Redis/Mongo/MySQL-backed limiters (e.g. RateLimiterRedis) with the same
 * `.consume()` API — swapping the store later is a change inside this file only;
 * nothing in `checkRateLimit`'s signature changes, so no call site needs touching.
 *
 * Call sites (unchanged by this swap):
 *   app/api/billing/paynimo-checkout/route.ts
 *   app/api/auth/send-2fa/route.ts
 *   app/api/auth/verify-2fa/route.ts
 *   app/api/license/activate/route.ts
 *   app/api/ingest/events/route.ts
 *   app/api/ingest/heartbeat/route.ts
 *   app/api/ingest/inventory/route.ts
 *   app/api/ingest/waf/route.ts
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiters = {
  mfa:        new RateLimiterMemory({ points: 30,    duration: 600 }),   // 30 per 10 min
  checkout:   new RateLimiterMemory({ points: 30,    duration: 3600 }),  // 30 per hour
  activation: new RateLimiterMemory({ points: 30,    duration: 3600 }),  // 30 per hour
  ingest:     new RateLimiterMemory({ points: 10000, duration: 60 }),    // 10000 per min
};

export type RateLimitType = keyof typeof limiters;

export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<{ success: boolean; retryAfter?: number }> {
  try {
    await limiters[type].consume(identifier, 1);
    return { success: true };
  } catch (rejected) {
    // rate-limiter-flexible rejects the promise both when the limit is hit (the
    // expected "blocked" path, with a RateLimiterRes object) and on a genuine internal
    // error (an actual Error instance) — these need different handling, or a real bug
    // silently gets treated as "user is just rate limited".
    if (rejected instanceof Error) {
      console.error('[rate-limit] Unexpected error, failing open:', rejected);
      return { success: true };
    }
    const res = rejected as { msBeforeNext: number };
    return { success: false, retryAfter: Math.max(1, Math.ceil(res.msBeforeNext / 1000)) };
  }
}

/** Best-effort client identifier for unauthenticated routes — IP first, fallback to UA. */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('user-agent') || 'unknown';
}