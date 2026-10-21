/** @type {import('next').NextConfig} */

const { withSentryConfig } = (() => {
  try { return require('@sentry/nextjs') } catch { return { withSentryConfig: (c) => c } }
})()

const nextConfig = {
  experimental: {
    typedRoutes:      true,
    serverComponentsExternalPackages: [
      'firebase-admin',
      'pino',
      'pino-pretty',
      '@react-pdf/renderer',
      'exceljs',
      'otplib',
      'bcryptjs',
    ],
  },

  // ── Images ──────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    formats:          ['image/avif', 'image/webp'],
    minimumCacheTTL:  86400,
  },

  // ── Compression ───────────────────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // ── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control',            value: 'on' },
          { key: 'X-Frame-Options',                   value: 'DENY' },
          { key: 'X-Content-Type-Options',            value: 'nosniff' },
          { key: 'X-XSS-Protection',                  value: '1; mode=block' },
          { key: 'Referrer-Policy',                   value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',                value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key:   'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key:   'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://storage.googleapis.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://api.stripe.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
              "media-src 'self' blob: https://*.supabase.co",
            ].join('; '),
          },
        ],
      },
      // Stripe webhook needs raw body — disable body size limit
      {
        source: '/api/stripe-webhook',
        headers: [{ key: 'X-Raw-Body', value: 'true' }],
      },
      // Service worker cache headers
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: '/admin', destination: '/dashboard/admin', permanent: true },
      { source: '/login', destination: '/auth/login',      permanent: true },
    ]
  },

  // ── Webpack ───────────────────────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules on client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:       false,
        net:      false,
        tls:      false,
        crypto:   false,
        stream:   false,
        path:     false,
        process:  false,
        'firebase-admin': false,
        'node-cron':      false,
        'bullmq':         false,
        'ioredis':        false,
      }
    }
    return config
  },

  // ── Output ────────────────────────────────────────────────────────────────
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,

  // ── Logging ───────────────────────────────────────────────────────────────
  logging: {
    fetches: { fullUrl: process.env.NODE_ENV === 'development' },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

// Sentry configuration
const sentryWebpackPluginOptions = {
  org:                   process.env.SENTRY_ORG,
  project:               process.env.SENTRY_PROJECT ?? 'luxsalon',
  silent:                !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps:        true,
  disableLogger:         true,
}

module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig
