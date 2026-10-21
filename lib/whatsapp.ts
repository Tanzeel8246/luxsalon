/**
 * WhatsApp Business Cloud API — Meta Official
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Required ENV:
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_BUSINESS_ACCOUNT_ID
 *   WHATSAPP_API_VERSION
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN
 */

import { logger } from './logger'

const BASE_URL  = 'https://graph.facebook.com'
const VERSION   = process.env.WHATSAPP_API_VERSION ?? 'v17.0'
const PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID!
const TOKEN     = process.env.WHATSAPP_ACCESS_TOKEN!
const MAX_RETRIES = 3

// ── Types ────────────────────────────────────────────────────────────────────

export interface WATextMessage {
  to:      string
  body:    string
}

export interface WATemplateMessage {
  to:           string
  templateName: string
  language:     string
  components?:  WATemplateComponent[]
}

export interface WATemplateComponent {
  type:       'header' | 'body' | 'button'
  parameters: WAParameter[]
  sub_type?:  string
  index?:     number
}

export interface WAParameter {
  type:  'text' | 'currency' | 'date_time' | 'image' | 'document'
  text?: string
  currency?: { fallback_value: string; code: string; amount_1000: number }
  date_time?: { fallback_value: string }
  image?:     { link: string }
}

export interface WADeliveryStatus {
  messageId:   string
  status:      'sent' | 'delivered' | 'read' | 'failed'
  timestamp:   string
  recipientId: string
  errors?:     WAError[]
}

interface WAError {
  code:    number
  title:   string
  message: string
}

interface WAResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

// ── Core send function with retry logic ─────────────────────────────────────

async function sendRequest(
  endpoint: string,
  payload: unknown,
  attempt = 1
): Promise<WAResponse> {
  const url = `${BASE_URL}/${VERSION}/${endpoint}`

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      const err = data?.error
      logger.error('WhatsApp API error', {
        status:   res.status,
        code:     err?.code,
        message:  err?.message,
        endpoint,
      })

      // Retry on transient errors (5xx, rate limit 429)
      if ((res.status >= 500 || res.status === 429) && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(r => setTimeout(r, delay))
        return sendRequest(endpoint, payload, attempt + 1)
      }

      throw new Error(`WhatsApp API failed: ${err?.message ?? res.statusText}`)
    }

    return data as WAResponse
  } catch (err) {
    if (attempt < MAX_RETRIES && err instanceof TypeError) {
      // Network error — retry
      await new Promise(r => setTimeout(r, 2000 * attempt))
      return sendRequest(endpoint, payload, attempt + 1)
    }
    throw err
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a plain text message.
 * Use for operational messages only — template for marketing.
 */
export async function sendTextMessage(msg: WATextMessage): Promise<string> {
  const phoneNumber = normalizePhone(msg.to)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                phoneNumber,
    type:              'text',
    text:              { preview_url: false, body: msg.body },
  }

  const res = await sendRequest(`${PHONE_ID}/messages`, payload)
  const messageId = res.messages[0]?.id

  logger.info('WhatsApp text sent', { to: phoneNumber, messageId })
  return messageId
}

/**
 * Send a pre-approved WhatsApp template message.
 * Templates must be approved in Meta Business Manager first.
 *
 * Template names in use:
 *   booking_confirmation    — appointment confirm
 *   appointment_reminder    — 24h reminder
 *   queue_ready             — customer's turn
 *   loyalty_tier_upgrade    — tier promotion
 *   churn_winback           — re-engagement with promo
 *   birthday_greeting       — birthday offer
 *   review_request          — post-service review
 *   payment_receipt         — payment confirmation
 *   cancellation_confirm    — booking cancelled
 *   refund_processed        — refund status
 */
export async function sendTemplateMessage(msg: WATemplateMessage): Promise<string> {
  const phoneNumber = normalizePhone(msg.to)

  const payload = {
    messaging_product: 'whatsapp',
    to:                phoneNumber,
    type:              'template',
    template: {
      name:       msg.templateName,
      language:   { code: msg.language ?? 'en' },
      components: msg.components ?? [],
    },
  }

  const res = await sendRequest(`${PHONE_ID}/messages`, payload)
  const messageId = res.messages[0]?.id

  logger.info('WhatsApp template sent', {
    to:           phoneNumber,
    template:     msg.templateName,
    messageId,
  })

  return messageId
}

// ── Pre-built message builders ───────────────────────────────────────────────

export const whatsappMessages = {
  bookingConfirmation: (params: {
    phone:       string
    name:        string
    service:     string
    date:        string
    time:        string
    staff:       string
    amount:      string
    bookingId:   string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'booking_confirmation',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.service },
          { type: 'text', text: params.date },
          { type: 'text', text: params.time },
          { type: 'text', text: params.staff },
          { type: 'text', text: params.amount },
          { type: 'text', text: params.bookingId },
        ],
      },
    ],
  }),

  appointmentReminder: (params: {
    phone:     string
    name:      string
    service:   string
    date:      string
    time:      string
    staff:     string
    salonName: string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'appointment_reminder',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.service },
          { type: 'text', text: params.date },
          { type: 'text', text: params.time },
          { type: 'text', text: params.staff },
          { type: 'text', text: params.salonName },
        ],
      },
    ],
  }),

  queueReady: (params: {
    phone:     string
    name:      string
    position:  number
    salonName: string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'queue_ready',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: String(params.position) },
          { type: 'text', text: params.salonName },
        ],
      },
    ],
  }),

  churnWinback: (params: {
    phone:      string
    name:       string
    promoCode:  string
    discount:   string
    expiry:     string
    bookingUrl: string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'churn_winback',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.discount },
          { type: 'text', text: params.promoCode },
          { type: 'text', text: params.expiry },
        ],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: params.bookingUrl }],
      },
    ],
  }),

  paymentReceipt: (params: {
    phone:      string
    name:       string
    amount:     string
    service:    string
    receiptNo:  string
    date:       string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'payment_receipt',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.amount },
          { type: 'text', text: params.service },
          { type: 'text', text: params.receiptNo },
          { type: 'text', text: params.date },
        ],
      },
    ],
  }),

  cancellationConfirm: (params: {
    phone:   string
    name:    string
    service: string
    date:    string
    time:    string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'cancellation_confirm',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.service },
          { type: 'text', text: params.date },
          { type: 'text', text: params.time },
        ],
      },
    ],
  }),

  refundProcessed: (params: {
    phone:     string
    name:      string
    amount:    string
    method:    string
    timeframe: string
  }): WATemplateMessage => ({
    to:           params.phone,
    templateName: 'refund_processed',
    language:     'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.amount },
          { type: 'text', text: params.method },
          { type: 'text', text: params.timeframe },
        ],
      },
    ],
  }),
}

// ── Webhook verification ────────────────────────────────────────────────────

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require('crypto')
  const appSecret = process.env.WHATSAPP_APP_SECRET!

  if (!appSecret) {
    logger.warn('WHATSAPP_APP_SECRET not set — skipping signature verification')
    return true
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex')}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

export function verifyWebhookChallenge(
  mode:      string,
  token:     string,
  challenge: string
): string | null {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified successfully')
    return challenge
  }

  logger.warn('WhatsApp webhook verification failed', { mode, token })
  return null
}

// ── Parse incoming webhook ──────────────────────────────────────────────────

export function parseWebhookDelivery(body: unknown): WADeliveryStatus[] {
  const statuses: WADeliveryStatus[] = []

  try {
    const wb = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id: string
              status: string
              timestamp: string
              recipient_id: string
              errors?: WAError[]
            }>
          }
        }>
      }>
    }

    for (const entry of wb.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          statuses.push({
            messageId:   status.id,
            status:      status.status as WADeliveryStatus['status'],
            timestamp:   new Date(parseInt(status.timestamp) * 1000).toISOString(),
            recipientId: status.recipient_id,
            errors:      status.errors,
          })
        }
      }
    }
  } catch (err) {
    logger.error('Failed to parse WhatsApp webhook', { err })
  }

  return statuses
}

// ── Utility ──────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')

  // Ensure international format (no leading +)
  if (digits.startsWith('0')) {
    // Pakistani number: 03001234567 → 923001234567
    return `92${digits.slice(1)}`
  }
  return digits
}

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  )
}
