import { getSupabaseClient } from '@/lib/supabase'

export type ZapierEventType =
  | 'new_booking'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'vip_customer_arrived'
  | 'low_stock_alert'
  | 'new_customer'
  | 'churn_risk_detected'
  | 'payment_received'
  | 'staff_check_in'
  | 'negative_review'

export interface ZapierEvent {
  event:     ZapierEventType
  timestamp: string
  salon_name: string
  data:      Record<string, unknown>
}

async function getZapierWebhookUrl(): Promise<string | null> {
  // Check environment variable first
  if (process.env.NEXT_PUBLIC_ZAPIER_WEBHOOK_URL) {
    return process.env.NEXT_PUBLIC_ZAPIER_WEBHOOK_URL
  }

  // Then check database config
  try {
    const supabase = getSupabaseClient()
    const { data: config } = await supabase
      .from('integration_configs')
      .select('config, is_enabled')
      .eq('provider', 'zapier')
      .single()

    if (config?.is_enabled && (config.config as any)?.webhook_url) {
      return (config.config as any).webhook_url
    }
  } catch (err) {
    console.warn('Could not fetch Zapier config from DB:', err)
  }

  return null
}

export const zapierService = {
  /**
   * Triggers a Zapier webhook with event data.
   * Returns true if successful, false otherwise.
   */
  async triggerWebhook(
    eventType: ZapierEventType,
    data: Record<string, unknown>
  ): Promise<boolean> {
    const webhookUrl = await getZapierWebhookUrl()

    if (!webhookUrl) {
      console.info('[Zapier] No webhook URL configured. Skipping trigger.')
      return false
    }

    const payload: ZapierEvent = {
      event:      eventType,
      timestamp:  new Date().toISOString(),
      salon_name: 'LuxSalon',
      data,
    }

    try {
      const response = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error(`[Zapier] Webhook failed: ${response.status} ${response.statusText}`)
        return false
      }

      console.info(`[Zapier] ✅ Event "${eventType}" triggered successfully.`)
      return true
    } catch (err) {
      console.error('[Zapier] Network error:', err)
      return false
    }
  },

  // ── Pre-built trigger helpers ─────────────────────────────────

  async onNewBooking(booking: Record<string, unknown>) {
    return this.triggerWebhook('new_booking', booking)
  },

  async onBookingCompleted(booking: Record<string, unknown>) {
    return this.triggerWebhook('booking_completed', booking)
  },

  async onBookingCancelled(booking: Record<string, unknown>) {
    return this.triggerWebhook('booking_cancelled', booking)
  },

  async onVipCustomerArrived(customer: Record<string, unknown>) {
    return this.triggerWebhook('vip_customer_arrived', customer)
  },

  async onLowStockAlert(item: Record<string, unknown>) {
    return this.triggerWebhook('low_stock_alert', item)
  },

  async onNewCustomer(customer: Record<string, unknown>) {
    return this.triggerWebhook('new_customer', customer)
  },

  async onChurnRiskDetected(prediction: Record<string, unknown>) {
    return this.triggerWebhook('churn_risk_detected', prediction)
  },

  async onPaymentReceived(payment: Record<string, unknown>) {
    return this.triggerWebhook('payment_received', payment)
  },

  async onNegativeReview(review: Record<string, unknown>) {
    return this.triggerWebhook('negative_review', review)
  },

  /**
   * Test the Zapier connection by sending a test event.
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const webhookUrl = await getZapierWebhookUrl()
    if (!webhookUrl) {
      return { success: false, message: 'No Zapier Webhook URL configured.' }
    }

    const ok = await this.triggerWebhook('new_booking', {
      test:    true,
      message: 'LuxSalon Zapier integration test event',
      booking_id: 'TEST-001',
      customer_name: 'Test Customer',
      service: 'Hair Cut',
      amount: 50,
    })

    return ok
      ? { success: true,  message: 'Zapier webhook triggered successfully!' }
      : { success: false, message: 'Zapier webhook failed. Check your webhook URL.' }
  },
}
