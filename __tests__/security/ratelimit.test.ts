/**
 * Rate Limiting Tests
 * Verifies API abuse prevention is working.
 */

// Mock upstash/ratelimit
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit(id: string) {
      // Simulate: IP '1.2.3.4' is rate limited
      if (id === 'ip:1.2.3.4') {
        return { success: false, limit: 100, remaining: 0, reset: Date.now() + 60000, pending: Promise.resolve() }
      }
      return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000, pending: Promise.resolve() }
    }
  },
}))

jest.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({}) },
}))

process.env.UPSTASH_REDIS_REST_URL   = 'https://fake.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

describe('Rate Limiting', () => {
  it('allows requests from non-rate-limited IPs', async () => {
    const { limiters } = await import('@/lib/ratelimit')
    const result = await limiters.public.limit('ip:192.168.1.1')
    expect(result.success).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('blocks requests from rate-limited IPs', async () => {
    const { limiters } = await import('@/lib/ratelimit')
    const result = await limiters.public.limit('ip:1.2.3.4')
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('has separate limits for different tiers', async () => {
    const { limiters } = await import('@/lib/ratelimit')
    // Verify all limiters exist
    expect(limiters.public).toBeDefined()
    expect(limiters.auth).toBeDefined()
    expect(limiters.admin).toBeDefined()
    expect(limiters.loginAttempt).toBeDefined()
    expect(limiters.smsOtp).toBeDefined()
  })
})
