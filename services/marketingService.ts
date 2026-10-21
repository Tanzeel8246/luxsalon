import { getSupabaseClient } from '@/lib/supabase'
import { addMonths, format } from 'date-fns'
import type { Campaign, GiftCard, Referral, NotificationLog, WhatsAppTemplate, ApiResponse } from '@/types'

// WhatsApp message templates
const WA_TEMPLATES: Record<string, string> = {
  booking_confirm: `✅ *Booking Confirmed!*\n\nHello {{name}},\n\nYour appointment is confirmed:\n📅 *{{date}}* at *{{time}}*\n✂️ Service: *{{service}}*\n👤 Stylist: *{{staff}}*\n💰 Total: *{{amount}}*\n\nSee you soon at LuxSalon! 💫`,
  reminder_24h:    `⏰ *Appointment Reminder*\n\nHi {{name}},\n\nYour appointment is tomorrow:\n📅 *{{date}}* at *{{time}}*\n✂️ *{{service}}* with *{{staff}}*\n\nReply CANCEL to cancel or RESCHEDULE to change.\n\n— LuxSalon Team`,
  queue_ready:     `🔔 *Your Turn!*\n\nHi {{name}},\n\nYour position has been called! Please come to the desk within 5 minutes.\n\nQueue #{{position}} | {{salon_name}}`,
  loyalty_upgrade: `🌟 *Tier Upgrade!*\n\nCongratulations {{name}}!\n\nYou've been upgraded to *{{tier}}* member!\n🎁 You now get {{discount}}% off every service.\n\nCurrent points: *{{points}}*\n\n— LuxSalon`,
  churn_winback:   `💛 *We Miss You!*\n\nHi {{name}},\n\nIt's been a while! Come back and enjoy *20% OFF* your next visit.\n\n🎁 Use code: *WELCOME{{code}}*\nValid until: {{expiry}}\n\nBook now: {{booking_link}}`,
  birthday:        `🎂 *Happy Birthday {{name}}!*\n\nWishing you a wonderful birthday! 🎉\n\nEnjoy a special *FREE haircut* on us today!\n\nShow this message at the salon.\n\n— Your LuxSalon Family`,
  review_request:  `⭐ *How Was Your Experience?*\n\nHi {{name}},\n\nThank you for visiting LuxSalon today!\n\nHow was your experience with *{{staff}}*?\n\nRate: 1-5: Reply with a number\n\nYour feedback means a lot to us! 🙏`,
}

export const marketingService = {
  // ── WhatsApp Notifications ───────────────────────────────────
  async sendWhatsApp(
    phone:        string,
    templateKey:  string,
    variables:    Record<string, string>,
    customerId?:  string
  ): Promise<ApiResponse<{ message_id: string }>> {
    const template = WA_TEMPLATES[templateKey]
    if (!template) return { data: null, error: 'Template not found' }

    let message = template
    Object.entries(variables).forEach(([key, val]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), val)
    })

    // In production: call WhatsApp Business API
    // const response = await fetch('https://graph.facebook.com/v17.0/YOUR_PHONE_ID/messages', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } })
    // })

    const messageId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    await this.logNotification({
      customer_id: customerId ?? null,
      channel:     'whatsapp',
      type:        templateKey,
      status:      'sent',
      message,
      meta:        { phone, template_key: templateKey, message_id: messageId },
    })

    return { data: { message_id: messageId }, error: null }
  },

  async sendAppointmentConfirmation(appointment: {
    customer_name: string
    customer_phone: string
    customer_id: string
    date:    string
    time:    string
    service: string
    staff:   string
    amount:  string
  }): Promise<void> {
    await this.sendWhatsApp(
      appointment.customer_phone,
      'booking_confirm',
      {
        name:    appointment.customer_name,
        date:    appointment.date,
        time:    appointment.time,
        service: appointment.service,
        staff:   appointment.staff,
        amount:  appointment.amount,
      },
      appointment.customer_id
    )
  },

  async sendQueueCallNotification(
    phone:      string,
    name:       string,
    position:   number,
    customerId: string
  ): Promise<void> {
    await this.sendWhatsApp(
      phone, 'queue_ready',
      { name, position: String(position), salon_name: 'LuxSalon' },
      customerId
    )
  },

  async sendChurnWinback(customerId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single() as any

    if (!customer?.phone) return { data: null, error: 'No phone number' }

    const code   = Math.random().toString(36).slice(2, 7).toUpperCase()
    const expiry = format(addMonths(new Date(), 1), 'MMM d, yyyy')

    await this.sendWhatsApp(
      customer.phone, 'churn_winback',
      {
        name:          customer.name,
        code,
        expiry,
        booking_link: `${process.env.NEXT_PUBLIC_APP_URL}/booking`,
      },
      customerId
    )

    return { data: undefined, error: null }
  },

  // ── Campaigns ────────────────────────────────────────────────
  async createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'sent_count' | 'delivered_count' | 'opened_count' | 'clicked_count' | 'converted_count'>): Promise<ApiResponse<Campaign>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ ...campaign, sent_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0, converted_count: 0 })
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getCampaigns(): Promise<ApiResponse<Campaign[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async launchCampaign(campaignId: string): Promise<ApiResponse<{ recipients: number }>> {
    const supabase = getSupabaseClient()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single() as any

    if (!campaign) return { data: null, error: 'Campaign not found' }

    let query = supabase.from('customers').select('id, name, phone, email')
    if (campaign.target_tiers?.length) query = query.in('tier', campaign.target_tiers)

    const { data: customers } = await query
    if (!customers?.length) return { data: { recipients: 0 }, error: null }

    await supabase.from('campaign_recipients').insert(
      customers.map(c => ({ campaign_id: campaignId, customer_id: c.id, status: 'pending' }))
    )

    await supabase
      .from('campaigns')
      .update({ status: 'running', sent_count: customers.length })
      .eq('id', campaignId)

    return { data: { recipients: customers.length }, error: null }
  },

  // ── Gift Cards ───────────────────────────────────────────────
  async createGiftCard(payload: {
    initial_value:   number
    purchased_by?:   string
    recipient_name?: string
    recipient_email?: string
    recipient_phone?: string
    message?:        string
    expires_months?: number
  }): Promise<ApiResponse<GiftCard>> {
    const supabase = getSupabaseClient()

    const code = [
      Math.random().toString(36).slice(2, 6).toUpperCase(),
      Math.random().toString(36).slice(2, 6).toUpperCase(),
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    ].join('-')

    const expiresAt = payload.expires_months
      ? format(addMonths(new Date(), payload.expires_months), 'yyyy-MM-dd')
      : format(addMonths(new Date(), 12), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('gift_cards')
      .insert({
        code,
        initial_value:   payload.initial_value,
        balance:         payload.initial_value,
        purchased_by:    payload.purchased_by ?? null,
        recipient_name:  payload.recipient_name ?? null,
        recipient_email: payload.recipient_email ?? null,
        recipient_phone: payload.recipient_phone ?? null,
        message:         payload.message ?? null,
        status:          'active',
        expires_at:      expiresAt,
      })
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async redeemGiftCard(code: string, amount: number, transactionId: string): Promise<ApiResponse<GiftCard>> {
    const supabase = getSupabaseClient()

    const { data: card } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single() as any

    if (!card) return { data: null, error: 'Invalid or expired gift card' }
    if (card.balance < amount) return { data: null, error: `Insufficient balance: $${card.balance.toFixed(2)}` }
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      await supabase.from('gift_cards').update({ status: 'expired' }).eq('id', card.id)
      return { data: null, error: 'Gift card has expired' }
    }

    const newBalance = Math.round((card.balance - amount) * 100) / 100

    await supabase.from('gift_card_transactions').insert({
      gift_card_id:   card.id,
      transaction_id: transactionId,
      amount_used:    amount,
      balance_before: card.balance,
      balance_after:  newBalance,
    })

    const { data: updated, error } = await supabase
      .from('gift_cards')
      .update({
        balance: newBalance,
        status:  newBalance === 0 ? 'used' : 'active',
      })
      .eq('id', card.id)
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data: updated, error: null }
  },

  async getGiftCards(): Promise<ApiResponse<GiftCard[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('gift_cards')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Referrals ────────────────────────────────────────────────
  async createReferralCode(customerId: string): Promise<ApiResponse<Referral>> {
    const supabase = getSupabaseClient()
    const code = 'REF-' + Math.random().toString(36).slice(2, 8).toUpperCase()

    const { data, error } = await supabase
      .from('referrals')
      .insert({ referrer_id: customerId, referral_code: code, status: 'pending' })
      .select('*, referrer:customers(*)')
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async processReferral(code: string, newCustomerId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()

    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .eq('status', 'pending')
      .single() as any

    if (!referral) return { data: null, error: 'Invalid referral code' }

    await supabase.from('referrals').update({
      referee_id:  newCustomerId,
      status:      'completed',
      rewarded_at: new Date().toISOString(),
    }).eq('id', referral.id)

    // Award points to referrer
    await supabase
      .from('customers')
      .update({ loyalty_points: supabase.rpc as never })
      .eq('id', referral.referrer_id)

    await supabase.from('loyalty_transactions').insert({
      customer_id: referral.referrer_id,
      points:      referral.reward_points,
      type:        'earn',
      description: `Referral bonus — friend joined!`,
    })

    return { data: undefined, error: null }
  },

  // ── Notification Log ─────────────────────────────────────────
  async logNotification(log: Omit<NotificationLog, 'id' | 'created_at'>): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.from('notification_logs').insert(log)
  },

  async getNotificationHistory(customerId: string): Promise<ApiResponse<NotificationLog[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },
}
