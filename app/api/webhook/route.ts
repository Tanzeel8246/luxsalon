import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { analyticsService } from '@/services/analyticsService'

export async function POST(request: NextRequest) {
  const body      = await request.json()
  const eventType = request.headers.get('x-event-type') ?? body.event ?? 'unknown'
  const secret    = request.headers.get('x-webhook-secret')

  const supabase = createAdminSupabaseClient()

  // Verify webhook secret
  const { data: webhook } = await supabase
    .from('webhooks')
    .select('id, secret, is_active')
    .eq('is_active', true)
    .limit(1)
    .single() as any

  if (!webhook || (webhook.secret && webhook.secret !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Route events
  switch (eventType) {
    case 'appointment.completed':
      if (body.data?.appointment_id) {
        await (supabase as any)
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', body.data.appointment_id)
        await analyticsService.log('appointment_completed_webhook', 'appointment', body.data.appointment_id, body.data)
      }
      break

    case 'payment.success':
      if (body.data?.transaction_id) {
        await (supabase as any)
          .from('payment_transactions')
          .update({ status: 'captured' })
          .eq('gateway_txn_id', body.data.transaction_id)
      }
      break

    case 'inventory.low_stock':
      if (body.data?.inventory_id) {
        await analyticsService.log('inventory_low_stock_webhook', 'inventory', body.data.inventory_id, body.data)
      }
      break

    default:
      await analyticsService.log(`webhook_${eventType}`, 'webhook', webhook.id, body)
  }

  return NextResponse.json({ received: true, event: eventType })
}
