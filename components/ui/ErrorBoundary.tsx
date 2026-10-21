'use client'
import React, { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
  onError?:  (error: Error) => void
}

interface State {
  hasError:   boolean
  error?:     Error
  eventId?:   string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error)

    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
    this.setState({ eventId })

    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-sm text-gray-400">
                An unexpected error occurred. Our team has been notified.
              </p>
              {this.state.eventId && (
                <p className="text-xs text-gray-600 mt-2 font-mono">
                  Error ID: {this.state.eventId}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-gold-gradient text-obsidian-950 text-sm font-semibold"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 rounded-lg border border-white/15 text-gray-300 text-sm"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left">
                <summary className="text-xs text-gray-500 cursor-pointer">Dev details</summary>
                <pre className="text-xs text-red-400 bg-red-500/5 rounded-lg p-3 mt-2 overflow-auto max-h-48 text-left">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Lightweight error boundary for cards/widgets (non-fatal)
export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  componentDidCatch(error: Error) { Sentry.captureException(error) }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-sm text-red-400">Failed to load this section.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs text-gray-400 hover:text-white mt-2 underline"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
