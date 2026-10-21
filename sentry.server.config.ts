import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:              process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment:      process.env.NODE_ENV,
  release:          process.env.APP_VERSION ?? '2.0.0',
  enabled:          !!process.env.SENTRY_DSN,
  integrations: [
    // Sentry.prismaIntegration(),
  ],
  beforeSend(event) {
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },
})
