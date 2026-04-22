import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverLogger } from './logger'

type Limiters = {
  ip: Ratelimit
  email: Ratelimit
}

let cached: Limiters | null | undefined

function buildLimiters(): Limiters | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    serverLogger.error(
      'Rate limiting disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set'
    )
    return null
  }

  const redis = new Redis({ url, token })

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
  }
}

function getLimiters(): Limiters | null {
  if (cached !== undefined) return cached
  cached = buildLimiters()
  return cached
}

export type RateLimitCheck =
  | { limited: false }
  | { limited: true; reason: 'ip' | 'email' }

/**
 * Check magic-link rate limits. Fails open if Upstash is misconfigured or
 * unreachable -- blocking sign-in because a rate-limit backend is down
 * is worse than a short window of unthrottled abuse.
 */
export async function checkMagicLinkRateLimit(
  ip: string,
  email: string
): Promise<RateLimitCheck> {
  const limiters = getLimiters()
  if (!limiters) return { limited: false }

  try {
    const ipResult = await limiters.ip.limit(ip)
    if (!ipResult.success) return { limited: true, reason: 'ip' }

    const emailResult = await limiters.email.limit(email.toLowerCase().trim())
    if (!emailResult.success) return { limited: true, reason: 'email' }

    return { limited: false }
  } catch (err) {
    serverLogger.error('Rate limit check failed; failing open:', err)
    return { limited: false }
  }
}
