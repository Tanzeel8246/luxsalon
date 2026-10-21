import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.ENCRYPTION_KEY             = 'a'.repeat(64)
process.env.TOTP_ISSUER                = 'LuxSalon-Test'
process.env.NEXT_PUBLIC_SUPABASE_URL   = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY  = 'test-service-key'
process.env.NEXT_PUBLIC_APP_URL        = 'http://localhost:3000'
// process.env.NODE_ENV = 'test'  // read-only in TS; Jest sets this automatically
process.env.DEFAULT_CURRENCY           = 'USD'
process.env.DEFAULT_TIMEZONE           = 'UTC'

// Mock Upstash Redis
jest.mock('@upstash/redis', () => ({
  Redis: class {
    static fromEnv() { return new this() }
    async get() { return null }
    async set() { return 'OK' }
    async setex() { return 'OK' }
    async del() { return 1 }
    async ping() { return 'PONG' }
    async scan() { return [0, []] }
  },
}))

// Mock Upstash Ratelimit
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit() {
      return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000, pending: Promise.resolve() }
    }
  },
}))

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps:        [],
  initializeApp: jest.fn().mockReturnValue({ name: 'test' }),
  credential:  { cert: jest.fn() },
  messaging:   jest.fn().mockReturnValue({
    send:               jest.fn().mockResolvedValue('message-id'),
    sendEachForMulticast: jest.fn().mockResolvedValue({ responses: [] }),
    subscribeToTopic:   jest.fn().mockResolvedValue({}),
    unsubscribeFromTopic: jest.fn().mockResolvedValue({}),
  }),
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      neq:    jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      lte:    jest.fn().mockReturnThis(),
      lt:     jest.fn().mockReturnThis(),
      gt:     jest.fn().mockReturnThis(),
      in:     jest.fn().mockReturnThis(),
      not:    jest.fn().mockReturnThis(),
      or:     jest.fn().mockReturnThis(),
      is:     jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      order:  jest.fn().mockReturnThis(),
      range:  jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      overlaps: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      like:   jest.fn().mockReturnThis(),
    })),
    rpc:     jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser:       jest.fn().mockResolvedValue({ data: { user: null } }),
      getSession:    jest.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: jest.fn(),
      signOut:       jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload:         jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://test.com/file.pdf' } }),
      }),
    },
    channel: jest.fn().mockReturnValue({
      on:        jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    }),
  })),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter:    jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() })),
  usePathname:  jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Suppress console.error in tests (Sentry noise)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (String(args[0]).includes('Warning:') || String(args[0]).includes('Sentry')) return
    originalError.call(console, ...args)
  }
})
afterAll(() => { console.error = originalError })
