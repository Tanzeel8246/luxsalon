/**
 * Upstash Redis — Production Cache Layer
 * Replaces broken DB-as-cache implementation.
 *
 * Required ENV:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis'
import { logger } from './logger'

// Singleton client
let _client: Redis | null = null

function getRedis(): Redis {
  if (!_client) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Upstash Redis credentials not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN')
    }
    _client = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _client
}

// ── TTL Constants ─────────────────────────────────────────────────────────────

export const TTL = {
  SERVICES:         600,   // 10 minutes — rarely changes
  STAFF_LIST:       300,   // 5 minutes
  QUEUE_STATS:       30,   // 30 seconds — fast-changing
  DASHBOARD_STATS:   60,   // 1 minute
  PRICING_RULES:    600,   // 10 minutes
  BRANCHES:        1800,   // 30 minutes
  FORECAST:        3600,   // 1 hour — AI forecasts
  USER_SESSION:    3600,   // 1 hour
  OTP_CODE:         300,   // 5 minutes — OTP codes
  RATE_LIMIT:        60,   // 1 minute window
} as const

// ── Cache Namespace Prefixes ───────────────────────────────────────────────────

export const KEYS = {
  services:       (tenantId: string) => `t:${tenantId}:services`,
  staffList:      (tenantId: string) => `t:${tenantId}:staff:list`,
  staffScore:     (tenantId: string, staffId: string, date: string) => `t:${tenantId}:staff:${staffId}:score:${date}`,
  queueStats:     (tenantId: string, date: string) => `t:${tenantId}:queue:stats:${date}`,
  dashboardStats: (tenantId: string, date: string) => `t:${tenantId}:dash:${date}`,
  pricingRules:   (tenantId: string) => `t:${tenantId}:pricing:rules`,
  branches:       (tenantId: string) => `t:${tenantId}:branches`,
  forecast:       (tenantId: string) => `t:${tenantId}:ai:forecast`,
  userSession:    (userId: string)   => `session:${userId}`,
  otpCode:        (userId: string)   => `otp:${userId}`,
  rateLimit:      (ip: string, endpoint: string) => `rl:${ip}:${endpoint}`,
  slots:          (serviceId: string, date: string) => `slots:${serviceId}:${date}`,
} as const

// ── Core Cache Operations ────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    const data  = await redis.get<T>(key)
    if (data !== null) {
      logger.debug('Cache HIT', { key })
    }
    return data
  } catch (err) {
    logger.error('Redis GET error', { key, err })
    return null   // Graceful degradation — fall through to DB
  }
}

export async function cacheSet<T>(
  key:  string,
  data: T,
  ttl:  number = TTL.DASHBOARD_STATS
): Promise<void> {
  try {
    const redis = getRedis()
    await redis.setex(key, ttl, JSON.stringify(data))
    logger.debug('Cache SET', { key, ttl })
  } catch (err) {
    logger.error('Redis SET error', { key, err })
    // Non-critical — continue without cache
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await getRedis().del(key)
    logger.debug('Cache DELETE', { key })
  } catch (err) {
    logger.error('Redis DEL error', { key, err })
  }
}

/**
 * Delete all keys matching a pattern.
 * Use for invalidating tenant data on updates.
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  try {
    const redis   = getRedis()
    let   cursor  = 0
    let   deleted = 0

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })
      cursor = parseInt(String(nextCursor), 10)

      if (keys.length > 0) {
        await redis.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== 0)

    logger.info('Cache pattern deleted', { pattern, deleted })
    return deleted
  } catch (err) {
    logger.error('Redis pattern delete error', { pattern, err })
    return 0
  }
}

/**
 * Cache-aside pattern: return cached value or compute and cache.
 */
export async function cacheGetOrSet<T>(
  key:      string,
  ttl:      number,
  fetcher:  () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached

  const fresh = await fetcher()
  await cacheSet(key, fresh, ttl)
  return fresh
}

// ── Tenant Cache Invalidation ────────────────────────────────────────────────

export async function invalidateTenantCache(tenantId: string): Promise<void> {
  await cacheDeletePattern(`t:${tenantId}:*`)
  logger.info('Tenant cache invalidated', { tenantId })
}

export async function invalidateServiceCache(tenantId: string): Promise<void> {
  await cacheDelete(KEYS.services(tenantId))
  await cacheDeletePattern(`slots:*`)
  logger.info('Service cache invalidated', { tenantId })
}

// ── OTP / Session Storage ─────────────────────────────────────────────────────

export async function storeOTP(userId: string, code: string): Promise<void> {
  await cacheSet(KEYS.otpCode(userId), code, TTL.OTP_CODE)
}

export async function verifyOTP(userId: string, code: string): Promise<boolean> {
  const redis = getRedis()
  const key   = KEYS.otpCode(userId)
  const stored = await redis.get<string>(key)

  if (stored !== code) return false

  // OTP is single-use — delete on successful verification
  await redis.del(key)
  return true
}

// ── Health Check ─────────────────────────────────────────────────────────────

export async function pingRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await getRedis().ping()
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
}
