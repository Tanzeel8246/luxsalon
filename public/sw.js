/**
 * LuxSalon Service Worker — Offline Mode
 * Caches: app shell, static assets, API responses
 *
 * Strategy:
 *  - Static assets: Cache First (serve from cache, update in background)
 *  - API GET requests: Network First with 5s timeout → cache fallback
 *  - POST/PATCH/DELETE: Network only (never cache mutations)
 *  - Queue board: Cache + Background sync on reconnect
 */

const CACHE_NAME     = 'luxsalon-v2'
const OFFLINE_URL    = '/offline.html'
const STATIC_ASSETS  = [
  '/',
  '/offline.html',
  '/dashboard',
  '/queue',
  '/booking',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// API routes to cache for offline reading
const CACHEABLE_API = [
  '/api/services',
  '/api/queue',
  '/api/health',
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets')
      return cache.addAll(STATIC_ASSETS.filter(url => {
        // Don't fail install if some assets are missing
        return fetch(url).then(() => true).catch(() => false)
      }))
    }).then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url         = new URL(request.url)

  // Skip non-GET requests (never cache mutations)
  if (request.method !== 'GET') return

  // Skip external requests
  if (!url.origin.includes(self.location.origin.split('//')[1])) return

  // Skip Supabase realtime/auth — always network
  if (url.hostname.includes('supabase.co')) return

  // ── Strategy: API routes — Network First ────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API.some(path => url.pathname.startsWith(path))

    if (isCacheable) {
      event.respondWith(networkFirstWithTimeout(request, 5000))
    }
    return  // Don't intercept non-cacheable API routes
  }

  // ── Strategy: Static assets — Cache First ───────────────────────────────
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // ── Strategy: App pages — Network First ─────────────────────────────────
  event.respondWith(networkFirstWithFallback(request))
})

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirstWithTimeout(request, timeoutMs) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeout)

    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Network failed or timeout — serve from cache
    const cached = await cache.match(request)
    if (cached) {
      console.log('[SW] Serving from cache (offline):', request.url)
      return cached
    }
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL)
      if (offlinePage) return offlinePage
    }

    return new Response('Offline', { status: 503 })
  }
}

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)

  if (event.tag === 'queue-update') {
    event.waitUntil(syncQueueData())
  }
  if (event.tag === 'checklist-submit') {
    event.waitUntil(syncPendingChecklists())
  }
})

async function syncQueueData() {
  try {
    const response = await fetch('/api/queue')
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put('/api/queue', response)
      console.log('[SW] Queue data synced')

      // Notify open clients
      const clients = await self.clients.matchAll()
      clients.forEach(client => client.postMessage({ type: 'QUEUE_SYNCED' }))
    }
  } catch (err) {
    console.error('[SW] Queue sync failed:', err)
  }
}

async function syncPendingChecklists() {
  // Retrieve from IndexedDB and send to server
  // (Full IndexedDB implementation would go here)
  console.log('[SW] Pending checklist sync')
}

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'LuxSalon', body: event.data.text() }
  }

  const options = {
    body:    payload.body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data:    payload.data ?? {},
    actions: payload.actions ?? [],
    tag:     payload.data?.type ?? 'general',
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  let targetUrl = '/'

  if (data?.type === 'queue_ready') targetUrl = '/queue'
  else if (data?.type === 'booking_confirmed') targetUrl = '/dashboard'
  else if (data?.type === 'new_booking') targetUrl = '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(targetUrl)
      } else {
        self.clients.openWindow(targetUrl)
      }
    })
  )
})
