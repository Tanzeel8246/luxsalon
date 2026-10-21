/**
 * API Rate Limiting — Upstash Ratelimit
 * Replaces missing rate limiting that allowed DDoS/abuse.
 *
 * Strategies:
 *   Public endpoints: 100 requests/minute sliding window
 *   Auth endpoints:   500 requests/minute per user
 *   Admin endpoints:  2000 requests/minute per user
 *   Auth attempts:    5 attempts/15 minutes (anti-brute-force)
 */

import { Ratelimit }      from '@upstash/ratelimit'
import { Redis }          from '@upstash/redis'
import { NextRequest }    from 'next/server'
import { NextResponse }   from 'next/server'
import { logger }         from './logger'

// ── Clients ───────────────────────────────────────────────────────────────────

function makeRatelimit(
  tokens:   number,
  window:   Parameters<typeof Ratelimit.slidingWindow>[1]
): Ratelimit {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // Return a permissive no-op limiter in dev if Redis not configured
    return {
      limit: async () => ({
        success: true, limit: tokens, reset: 0, remaining: tokens, pending: Promise.resolve(),
      }),
    } as unknown as Ratelimit
  }

  return new Ratelimit({
    redis:     Redis.fromEnv(),
    limiter:   Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix:    'luxsalon:rl',
  })
}

export const limiters = {
  public:    makeRatelimit(
    parseInt(process.env.RATE_LIMIT_MAX_PUBLIC  ?? '100', 10),
    '1 m'
  ),
  auth:      makeRatelimit(
    parseInt(process.env.RATE_LIMIT_MAX_AUTH    ?? '500', 10),
    '1 m'
  ),
  admin:     makeRatelimit(2000, '1 m'),
  loginAttempt: makeRatelimit(5, '15 m'),   // brute-force protection
  smsOtp:    makeRatelimit(3, '10 m'),      // OTP spam protection
  webhook:   makeRatelimit(1000, '1 m'),    // webhook endpoints
}

// ── Identifier extraction ──────────────────────────────────────────────────────

function getIdentifier(request: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`

  // X-Forwarded-For → first IP (client IP behind proxy)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp    = request.headers.get('x-real-ip')
  const ip        = forwarded?.split(',')[0].trim() ?? realIp ?? '127.0.0.1'

  return `ip:${ip}`
}

// ── Middleware helper ─────────────────────────────────────────────────────────

export type LimiterTier = keyof typeof limiters

/**
 * Apply rate limiting to an API route handler.
 * Returns 429 response if limit exceeded, otherwise continues.
 *
 * Usage in API route:
 *   const limited = await applyRateLimit(request, 'public')
 *   if (limited) return limited
 */
export async function applyRateLimit(
  request: NextRequest,
  tier:    LimiterTier = 'public',
  userId?: string
): Promise<NextResponse | null> {
  const identifier = getIdentifier(request, userId)
  const limiter    = limiters[tier]

  const result = await limiter.limit(identifier)

  // Always set rate limit headers
  const headers = {
    'X-RateLimit-Limit':     String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(Math.floor(result.reset / 1000)),
    'Retry-After':           result.success ? '0' : String(Math.ceil((result.reset - Date.now()) / 1000)),
  }

  if (!result.success) {
    logger.warn('Rate limit exceeded', {
      identifier,
      tier,
      path: request.nextUrl.pathname,
    })

    return NextResponse.json(
      {
        error:    'Too Many Requests',
        message:  'Rate limit exceeded. Please slow down.',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      { status: 429, headers }
    )
  }

  return null   // Not rate limited — proceed
}

/**
 * Create a response with rate limit headers attached.
 * Attach to all API responses for client awareness.
 */
export async function withRateLimitHeaders(
  request:  NextRequest,
  response: NextResponse,
  tier:     LimiterTier = 'public',
  userId?:  string
): Promise<NextResponse> {
  const identifier = getIdentifier(request, userId)
  const result     = await limiters[tier].limit(identifier)

  response.headers.set('X-RateLimit-Limit',     String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset',     String(Math.floor(result.reset / 1000)))

  return response
}
