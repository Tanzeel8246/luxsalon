/**
 * Structured Logger — replaces scattered console.log calls.
 * Uses pino for structured JSON logging.
 * In production: ships logs to Sentry/Datadog.
 */

import pino from 'pino'

const isDev  = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

export const logger = pino({
  level:  isTest ? 'silent' : isDev ? 'debug' : 'info',
  ...(isDev ? {
    transport: {
      target:  'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  } : {
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
  base: {
    service: 'luxsalon-api',
    version: process.env.APP_VERSION ?? '2.0.0',
    env:     process.env.NODE_ENV,
  },
  redact: {
    paths:  ['*.password', '*.secret', '*.token', '*.key', '*.credit_card', '*.cvv'],
    censor: '[REDACTED]',
  },
})

export type Logger = typeof logger
