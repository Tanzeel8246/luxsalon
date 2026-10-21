/**
 * WhatsApp Business Cloud API Webhook
 * Handles: delivery status updates, incoming messages
 *
 * Meta calls this endpoint for:
 *  - Delivery receipts (sent/delivered/read/failed)
 *  - Incoming customer messages (to be handled by chatbot)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  parseWebhookDelivery,
} from '@/lib/whatsapp'
import { logger } from '@/lib/logger'

// ── GET: Webhook verification challenge ──────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode      = searchParams.get('hub.mode') ?? ''
  const token     = searchParams.get('hub.verify_token') ?? ''
  const challenge = searchParams.get('hub.challenge') ?? ''

  const result = verifyWebhookChallenge(mode, token, challenge)

  if (!result) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return plain challenge string (not JSON)
  return new NextResponse(result, {
    status:  200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// ── POST: Process incoming webhook events ─────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody   = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  // Verify webhook is from Meta
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('WhatsApp webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase  = createAdminSupabaseClient()
  const deliveries = parseWebhookDelivery(body)

  // Process delivery status updates
  for (const delivery of deliveries) {
    logger.info('WhatsApp delivery status', {
      messageId:   delivery.messageId,
      status:      delivery.status,
      recipientId: delivery.recipientId,
    })

    // Update notification log
    await (supabase as any)
      .from('notification_logs')
      .update({ status: mapWAStatus(delivery.status) })
      .eq('meta', supabase.rpc as never)
      // Note: In production, match by message_id stored in meta JSONB

    // Handle failed deliveries
    if (delivery.status === 'failed' && delivery.errors?.length) {
      const errorCode = delivery.errors[0]?.code
      logger.error('WhatsApp message failed', {
        messageId:   delivery.messageId,
        recipientId: delivery.recipientId,
        errorCode,
        errorMsg:    delivery.errors[0]?.message,
      })

      // Log failed delivery for retry
      await (supabase as any).from('notification_logs').insert({
        channel:  'whatsapp',
        type:     'delivery_failure',
        status:   'failed',
        message:  `Error ${errorCode}: ${delivery.errors[0]?.message}`,
        meta: {
          message_id:   delivery.messageId,
          recipient_id: delivery.recipientId,
          error_code:   errorCode,
        },
      })
    }
  }

  // Always respond 200 — Meta will retry on non-200
  return NextResponse.json({ status: 'ok' })
}

function mapWAStatus(
  status: 'sent' | 'delivered' | 'read' | 'failed'
): 'sent' | 'delivered' | 'read' | 'failed' {
  return status
}
