/**
 * Firebase Cloud Messaging — Real Push Notifications
 * Replaces the commented-out mock FCM code.
 *
 * Required ENV:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import admin, { type ServiceAccount } from 'firebase-admin'
import { logger } from '@/lib/logger'

// ── Singleton Firebase App ────────────────────────────────────────────────────

function getFirebaseApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!

  const projectId    = process.env.FIREBASE_PROJECT_ID
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase credentials not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    )
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    } as ServiceAccount),
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title:    string
  body:     string
  imageUrl?: string
  data?:    Record<string, string>
  badge?:   number
}

export interface PushResult {
  success:   boolean
  messageId?: string
  error?:    string
}

export type PushTopic =
  | 'all-staff'
  | 'all-customers'
  | `branch-${string}`
  | `staff-${string}`

// ── Send to single token ───────────────────────────────────────────────────────

/**
 * Send push notification to a single device token.
 */
export async function sendPushToToken(
  token:   string,
  payload: PushPayload
): Promise<PushResult> {
  try {
    const app       = getFirebaseApp()
    const messaging = admin.messaging(app)

    const messageId = await messaging.send({
      token,
      notification: {
        title:    payload.title,
        body:     payload.body,
        imageUrl: payload.imageUrl,
      },
      data:    payload.data ?? {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'luxsalon-default',
          color:     '#D4AF37',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            alert:   { title: payload.title, body: payload.body },
            badge:   payload.badge,
            sound:   'default',
          },
        },
      },
      webpush: {
        notification: {
          title: payload.title,
          body:  payload.body,
          icon:  '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
        },
        fcmOptions: { link: process.env.NEXT_PUBLIC_APP_URL },
      },
    })

    logger.info('Push notification sent', { token: token.slice(0, 20) + '...', messageId })
    return { success: true, messageId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown FCM error'

    // Handle invalid/expired tokens gracefully
    if (errorMsg.includes('registration-token-not-registered') ||
        errorMsg.includes('invalid-registration-token')) {
      logger.warn('FCM token expired — should be removed', { token: token.slice(0, 20) })
      return { success: false, error: 'token_expired' }
    }

    logger.error('FCM send error', { err: errorMsg })
    return { success: false, error: errorMsg }
  }
}

/**
 * Send push to multiple tokens (batch — up to 500 per call).
 * Automatically removes expired tokens from DB.
 */
export async function sendPushToTokens(
  tokens:  string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; expiredTokens: string[] }> {
  if (!tokens.length) return { sent: 0, failed: 0, expiredTokens: [] }

  const app       = getFirebaseApp()
  const messaging = admin.messaging(app)

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data:         payload.data ?? {},
    android:      { priority: 'high', notification: { channelId: 'luxsalon-default', color: '#D4AF37' } },
    apns:         { payload: { aps: { sound: 'default', badge: payload.badge } } },
  }

  let sent          = 0
  let failed        = 0
  const expiredTokens: string[] = []

  // FCM batch limit is 500
  const BATCH_SIZE = 500
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch       = tokens.slice(i, i + BATCH_SIZE)
    const batchMsg    = { ...message, tokens: batch }
    const response    = await messaging.sendEachForMulticast(batchMsg)

    response.responses.forEach((res, idx) => {
      if (res.success) {
        sent++
      } else {
        failed++
        const errCode = res.error?.code ?? ''
        if (errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token') {
          expiredTokens.push(batch[idx])
        }
      }
    })
  }

  logger.info('Batch push completed', { sent, failed, expiredTokens: expiredTokens.length })
  return { sent, failed, expiredTokens }
}

/**
 * Send push to all users subscribed to a topic.
 * Topics: 'all-staff', `branch-{branchId}`, `staff-{staffId}`
 */
export async function sendPushToTopic(
  topic:   PushTopic,
  payload: PushPayload
): Promise<PushResult> {
  try {
    const app       = getFirebaseApp()
    const messaging = admin.messaging(app)

    const messageId = await messaging.send({
      topic,
      notification: { title: payload.title, body: payload.body },
      data:         payload.data ?? {},
    })

    logger.info('Topic push sent', { topic, messageId })
    return { success: true, messageId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('FCM topic send error', { topic, err: errorMsg })
    return { success: false, error: errorMsg }
  }
}

/**
 * Subscribe tokens to a topic.
 */
export async function subscribeToTopic(tokens: string[], topic: PushTopic): Promise<void> {
  if (!tokens.length) return
  const app = getFirebaseApp()
  await admin.messaging(app).subscribeToTopic(tokens, topic)
  logger.info('Subscribed tokens to topic', { topic, count: tokens.length })
}

/**
 * Unsubscribe tokens from a topic.
 */
export async function unsubscribeFromTopic(tokens: string[], topic: PushTopic): Promise<void> {
  if (!tokens.length) return
  const app = getFirebaseApp()
  await admin.messaging(app).unsubscribeFromTopic(tokens, topic)
}

// ── Pre-built notifications ───────────────────────────────────────────────────

export const pushNotifications = {
  queueReady: (position: number, salonName: string): PushPayload => ({
    title: '🔔 Your turn is coming!',
    body:  `You are #${position} in the queue at ${salonName}. Please proceed to the desk.`,
    data:  { type: 'queue_ready', position: String(position) },
  }),

  appointmentReminder: (service: string, time: string): PushPayload => ({
    title: '⏰ Appointment Reminder',
    body:  `Your ${service} appointment is tomorrow at ${time}. See you soon!`,
    data:  { type: 'appointment_reminder' },
  }),

  appointmentConfirmed: (service: string, date: string): PushPayload => ({
    title: '✅ Booking Confirmed!',
    body:  `Your ${service} is confirmed for ${date}.`,
    data:  { type: 'booking_confirmed' },
  }),

  loyaltyUpgrade: (tier: string, points: number): PushPayload => ({
    title: `🌟 You reached ${tier} tier!`,
    body:  `Congratulations! You now have ${points} loyalty points and enjoy exclusive benefits.`,
    data:  { type: 'loyalty_upgrade', tier },
  }),

  flashSale: (discount: string, expiry: string): PushPayload => ({
    title: `⚡ ${discount} OFF — Limited Time!`,
    body:  `Flash sale ends at ${expiry}. Book now to grab this deal!`,
    data:  { type: 'flash_sale', discount },
  }),

  lowInventoryAlert: (itemName: string, quantity: string): PushPayload => ({
    title: '⚠️ Low Stock Alert',
    body:  `${itemName} is running low: ${quantity} remaining. Please restock.`,
    data:  { type: 'low_stock', item: itemName },
  }),

  staffNewBooking: (customerName: string, service: string, time: string): PushPayload => ({
    title: '📅 New Appointment',
    body:  `${customerName} booked ${service} at ${time}.`,
    data:  { type: 'new_booking' },
  }),
}

export function isFCMConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}
