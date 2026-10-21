'use client'
import { useEffect } from 'react'
import { logger }    from '@/lib/logger'

/**
 * Registers the Service Worker for PWA / offline support.
 * Must be rendered inside a client component.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope:      '/',
          updateViaCache: 'none',
        })

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — show update prompt
              const shouldUpdate = window.confirm(
                'A new version of LuxSalon is available. Update now?'
              )
              if (shouldUpdate) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
                window.location.reload()
              }
            }
          })
        })

        console.info('[SW] Registered:', registration.scope)

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'QUEUE_SYNCED') {
            // Queue data was synced in background
            window.dispatchEvent(new CustomEvent('queue-synced'))
          }
        })

        // Register for push notifications if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          await subscribeToPush(registration)
        }
      } catch (err) {
        console.warn('[SW] Registration failed:', err)
      }
    }

    register()
  }, [])

  return <>{children}</>
}

async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<void> {
  try {
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlB64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
      ) as any,
    })

    // Save subscription to server
    await fetch('/api/notifications/push-subscription', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sub.toJSON()),
    })
  } catch (err) {
    console.warn('[SW] Push subscription failed:', err)
  }
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const output   = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

/**
 * Request push notification permission from user.
 * Call this after a user action (button click).
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false

  if (Notification.permission === 'granted') return true

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}
