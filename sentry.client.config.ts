import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:              process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  environment:      process.env.NODE_ENV,
  release:          process.env.APP_VERSION ?? '2.0.0',
  enabled:          !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.replayIntegration({
      maskAllText:   true,
      blockAllMedia: true,
    }),
  ],
  beforeSend(event) {
    // Strip PII from error events
    if (event.user) {
      delete event.user.email
      delete event.user.username
    }
    return event
  },
})
