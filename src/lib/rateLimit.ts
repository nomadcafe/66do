import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverLogger } from './logger'

type Limiters = {
  ip: Ratelimit
  email: Ratelimit
  userWrite: Ratelimit
  userAudit: Ratelimit
}

let cached: Limiters | null | undefined

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function buildLimiters(): Limiters | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    serverLogger.error(
      'Rate limiting unavailable: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set'
    )
    return null
  }

  // Wrap construction in try-catch — Upstash 的 `new Redis({...})` 会同步抛
  // UrlError 等异常（实测：env var 里多写了一对引号 → URL 不以 https 开头 →
  // 抛错）。如果 throw 冒泡上去，会被路由 outer catch 当作 500 返回。
  let redis
  try {
    redis = new Redis({ url, token })
  } catch (err) {
    serverLogger.error(
      'Rate limiting unavailable: Upstash Redis client construction failed (likely bad URL/token):',
      err
    )
    return null
  }

  return {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'ratelimit:magic-link:ip',
      analytics: false,
    }),
    email: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'ratelimit:magic-link:email',
      analytics: false,
    }),
    userWrite: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'ratelimit:write:user',
      analytics: false,
    }),
    // Audit endpoints (notify-signin, notify-sensitive) cap aggressively:
    // they get one legitimate ping per sign-in / sensitive op, so 60/h is
    // ample headroom while bounding the SNR-flooding attack on the Recent
    // Activity panel from "drown 1 legit event in 10,000 fakes" to "in ~60".
    userAudit: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 h'),
      prefix: 'ratelimit:audit:user',
      analytics: false,
    }),
  }
}

function getLimiters(): Limiters | null {
  if (cached !== undefined) return cached
  cached = buildLimiters()
  return cached
}

export type RateLimitCheck =
  | { limited: false }
  | { limited: true; reason: 'ip' | 'email' | 'backend' }

/**
 * Check magic-link rate limits.
 *
 * Production: fails *closed* on missing config or backend errors — callers
 *   get `{ limited: true, reason: 'backend' }` and should return 503. A
 *   silent fail-open here would turn one bad deploy into an open relay for
 *   email-enumeration / Supabase quota burn.
 * Dev/local: fails *open* so contributors don't need Upstash creds to run
 *   sign-in locally.
 */
export async function checkMagicLinkRateLimit(
  ip: string,
  email: string
): Promise<RateLimitCheck> {
  const limiters = getLimiters()
  if (!limiters) {
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }

  try {
    const ipResult = await limiters.ip.limit(ip)
    if (!ipResult.success) return { limited: true, reason: 'ip' }

    const emailResult = await limiters.email.limit(email.toLowerCase().trim())
    if (!emailResult.success) return { limited: true, reason: 'email' }

    return { limited: false }
  } catch (err) {
    serverLogger.error('Rate limit check failed:', err)
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }
}

export type WriteRateLimitCheck =
  | { limited: false }
  | { limited: true; reason: 'rate' | 'backend' }

/**
 * Per-user rate limit for state-changing API routes. Same prod-vs-dev
 * posture as checkMagicLinkRateLimit: fails closed in production so a
 * misconfigured rate-limit backend cannot silently disable write-flood
 * protection.
 */
export async function checkUserWriteRateLimit(
  userId: string
): Promise<WriteRateLimitCheck> {
  const limiters = getLimiters()
  if (!limiters) {
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }

  try {
    const res = await limiters.userWrite.limit(userId)
    return res.success ? { limited: false } : { limited: true, reason: 'rate' }
  } catch (err) {
    serverLogger.error('User write rate limit check failed:', err)
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }
}

export type AuditRateLimitCheck =
  | { limited: false }
  | { limited: true; reason: 'rate' | 'backend' }

/**
 * Per-user rate limit for audit-log endpoints (notify-signin,
 * notify-sensitive). Tighter cap than userWrite — these endpoints are
 * append-only signal records, so abuse looks like flooding to bury legit
 * events in noise.
 *
 * Unlike checkUserWriteRateLimit, callers should *silently drop* on
 * `reason: 'rate'` (return 200 without writing) so the attacker gets no
 * feedback about the cap. On `reason: 'backend'`, callers should allow the
 * write through — losing audit during an Upstash outage is worse than the
 * brief flood-window it leaves open.
 */
export async function checkUserAuditRateLimit(
  userId: string
): Promise<AuditRateLimitCheck> {
  const limiters = getLimiters()
  if (!limiters) {
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }

  try {
    const res = await limiters.userAudit.limit(userId)
    return res.success ? { limited: false } : { limited: true, reason: 'rate' }
  } catch (err) {
    serverLogger.error('User audit rate limit check failed:', err)
    return isProduction() ? { limited: true, reason: 'backend' } : { limited: false }
  }
}

/**
 * Startup probe. In production, throws if the rate-limit backend can't be
 * initialised so a bad deploy fails loud at boot instead of every request
 * silently sliding through unthrottled. Invoked from instrumentation.ts.
 */
export function assertRateLimitReadyInProd(): void {
  if (!isProduction()) return
  if (!getLimiters()) {
    throw new Error(
      'Rate limiting required in production but Upstash is unconfigured or unreachable. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN and verify the values.'
    )
  }
}
