/**
 * Environment Variable Validation
 * Crashes on startup if critical ENV vars are missing.
 * Warns about optional but recommended vars.
 *
 * Call at app startup: validateEnv()
 */

interface EnvVar {
  key:      string
  required: boolean
  desc:     string
  example?: string
}

const ENV_SCHEMA: EnvVar[] = [
  // ── Critical (app won't start without these) ─────────────────────────────
  { key: 'NEXT_PUBLIC_SUPABASE_URL',       required: true,  desc: 'Supabase project URL',           example: 'https://xxx.supabase.co' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',  required: true,  desc: 'Supabase anonymous key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',      required: true,  desc: 'Supabase service role key (server-only)' },
  { key: 'NEXT_PUBLIC_APP_URL',            required: true,  desc: 'Public app URL',                  example: 'https://app.luxsalon.com' },
  { key: 'CSRF_SECRET',                    required: true,  desc: 'CSRF secret (32+ chars)',         example: 'openssl rand -hex 32' },

  // ── Payments (required for POS) ──────────────────────────────────────────
  { key: 'STRIPE_SECRET_KEY',              required: false, desc: 'Stripe secret key (required for card payments)' },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', required: false, desc: 'Stripe publishable key' },
  { key: 'STRIPE_WEBHOOK_SECRET',          required: false, desc: 'Stripe webhook secret' },

  // ── WhatsApp (required for notifications) ────────────────────────────────
  { key: 'WHATSAPP_PHONE_NUMBER_ID',       required: false, desc: 'WhatsApp Business phone number ID' },
  { key: 'WHATSAPP_ACCESS_TOKEN',          required: false, desc: 'WhatsApp Cloud API access token' },
  { key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',  required: false, desc: 'WhatsApp webhook verification token' },

  // ── Firebase (required for push notifications) ───────────────────────────
  { key: 'FIREBASE_PROJECT_ID',            required: false, desc: 'Firebase project ID' },
  { key: 'FIREBASE_CLIENT_EMAIL',          required: false, desc: 'Firebase service account email' },
  { key: 'FIREBASE_PRIVATE_KEY',           required: false, desc: 'Firebase private key' },

  // ── Redis (required for caching + rate limiting) ─────────────────────────
  { key: 'UPSTASH_REDIS_REST_URL',         required: false, desc: 'Upstash Redis REST URL' },
  { key: 'UPSTASH_REDIS_REST_TOKEN',       required: false, desc: 'Upstash Redis REST token' },

  // ── Security ─────────────────────────────────────────────────────────────
  { key: 'ENCRYPTION_KEY',                 required: false, desc: 'AES-256-GCM key for TOTP secrets (64 hex chars)', example: 'openssl rand -hex 32' },
  { key: 'JWT_SECRET',                     required: false, desc: 'JWT signing secret' },

  // ── Optional services ────────────────────────────────────────────────────
  { key: 'GOOGLE_CLIENT_ID',               required: false, desc: 'Google OAuth client ID (calendar sync)' },
  { key: 'GOOGLE_CLIENT_SECRET',           required: false, desc: 'Google OAuth client secret' },
  { key: 'RESEND_API_KEY',                 required: false, desc: 'Resend email API key' },
  { key: 'SENTRY_DSN',                     required: false, desc: 'Sentry error monitoring DSN' },

  // ── Business config ───────────────────────────────────────────────────────
  { key: 'DEFAULT_TIMEZONE',               required: false, desc: 'Default timezone', example: 'Asia/Karachi' },
  { key: 'DEFAULT_CURRENCY',               required: false, desc: 'Default currency code', example: 'PKR' },
  { key: 'SUPABASE_STORAGE_BUCKET',        required: false, desc: 'Supabase storage bucket name', example: 'luxsalon-assets' },
]

interface ValidationResult {
  valid:    boolean
  errors:   string[]
  warnings: string[]
}

export function validateEnv(): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  for (const def of ENV_SCHEMA) {
    const val = process.env[def.key]

    if (!val || val.trim() === '') {
      if (def.required) {
        errors.push(`❌ MISSING REQUIRED: ${def.key} — ${def.desc}${def.example ? ` (e.g. ${def.example})` : ''}`)
      } else {
        warnings.push(`⚠️  Optional not set: ${def.key} — ${def.desc}`)
      }
    }
  }

  // Additional validation
  const encKey = process.env.ENCRYPTION_KEY
  if (encKey && encKey.length < 64) {
    errors.push('❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate: openssl rand -hex 32')
  }

  const csrfSecret = process.env.CSRF_SECRET
  if (csrfSecret && csrfSecret.length < 32) {
    errors.push('❌ CSRF_SECRET must be at least 32 characters')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && !appUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
    errors.push('❌ NEXT_PUBLIC_APP_URL must use HTTPS in production')
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && stripeKey.startsWith('sk_live_') && process.env.NODE_ENV !== 'production') {
    errors.push('❌ STRIPE live key detected in non-production environment')
  }

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  }
}

export function validateEnvOrThrow(): void {
  const result = validateEnv()

  if (process.env.NODE_ENV === 'development') {
    // In development: log warnings, don't crash on optional vars
    if (result.warnings.length > 0) {
      console.log('\n⚙️  LuxSalon — Environment Check')
      console.log('━'.repeat(50))
      result.warnings.forEach(w => console.log(w))
      console.log('━'.repeat(50))
      console.log('ℹ️  Optional features disabled. See .env.example for full setup.\n')
    }

    if (result.errors.length > 0) {
      console.error('\n🚨 CRITICAL ENV ERRORS:')
      result.errors.forEach(e => console.error(e))
      process.exit(1)
    }
  } else {
    // In production: fail hard on ANY error
    if (!result.valid) {
      console.error('\n🚨 PRODUCTION ENV VALIDATION FAILED:')
      result.errors.forEach(e => console.error(e))
      console.error('\nSee .env.example for required variables.')
      process.exit(1)
    }
  }
}

// Typed env accessors (never returns undefined after validation)
export const env = {
  supabaseUrl:        () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey:    () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY!,
  appUrl:             () => process.env.NEXT_PUBLIC_APP_URL!,
  stripeKey:          () => process.env.STRIPE_SECRET_KEY,
  stripeWebhook:      () => process.env.STRIPE_WEBHOOK_SECRET,
  waToken:            () => process.env.WHATSAPP_ACCESS_TOKEN,
  waPhoheId:          () => process.env.WHATSAPP_PHONE_NUMBER_ID,
  redisUrl:           () => process.env.UPSTASH_REDIS_REST_URL,
  redisToken:         () => process.env.UPSTASH_REDIS_REST_TOKEN,
  encryptionKey:      () => process.env.ENCRYPTION_KEY,
  sentryDsn:          () => process.env.SENTRY_DSN,
  timezone:           () => process.env.DEFAULT_TIMEZONE ?? 'UTC',
  currency:           () => process.env.DEFAULT_CURRENCY ?? 'USD',
  storageBucket:      () => process.env.SUPABASE_STORAGE_BUCKET ?? 'luxsalon-assets',
  isProduction:       () => process.env.NODE_ENV === 'production',
  isDevelopment:      () => process.env.NODE_ENV === 'development',
}
