'use client'
import { useEffect } from 'react'
import * as Sentry   from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ background: '#0A0A0A', color: '#fff', fontFamily: 'system-ui', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
              ✂️
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#D4AF37', marginBottom: '10px' }}>
              LuxSalon — Unexpected Error
            </h1>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>
              Something went wrong on our end. Our team has been automatically notified.
            </p>
            {error.digest && (
              <p style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', marginBottom: '24px' }}>
                Ref: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{ padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg,#D4AF37,#F4E06B)', color: '#0A0A0A', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#d1d5db', cursor: 'pointer', fontSize: '14px' }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
