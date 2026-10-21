/**
 * Background Job Scheduler
 * Uses node-cron for scheduled tasks.
 * For production SaaS: migrate to BullMQ with Upstash Redis.
 *
 * Jobs:
 *  - Appointment reminders (24h + 2h before)
 *  - Churn detection (daily at 2am)
 *  - Demand forecast update (daily at 3am)
 *  - Materialized view refresh (hourly)
 *  - Subscription renewal checks (daily at midnight)
 *  - Inventory low-stock alerts (daily at 6am)
 *  - Waitlist notification on cancellation (realtime via trigger)
 */

import cron from 'node-cron'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { sendTemplateMessage, whatsappMessages, isWhatsAppConfigured } from '@/lib/whatsapp'
import { aiService }  from '@/services/aiService'
import { logger }     from '@/lib/logger'
import { format, subHours, addHours, parseISO } from 'date-fns'

let schedulerStarted = false

export function startScheduler() {
  if (schedulerStarted) {
    logger.warn('Scheduler already running — skipping')
    return
  }
  schedulerStarted = true

  logger.info('Starting LuxSalon background scheduler')

  // ── Appointment reminders: every 15 minutes ─────────────────────────────────
  cron.schedule('*/15 * * * *', async () => {
    await sendAppointmentReminders()
  }, { name: 'appointment-reminders', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Churn detection: daily at 2:00 AM ──────────────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    await runChurnDetection()
  }, { name: 'churn-detection', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Demand forecasting: daily at 3:00 AM ───────────────────────────────────
  cron.schedule('0 3 * * *', async () => {
    await refreshDemandForecast()
  }, { name: 'demand-forecast', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Materialized views: hourly ──────────────────────────────────────────────
  cron.schedule('5 * * * *', async () => {
    await refreshMaterializedViews()
  }, { name: 'mv-refresh', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Subscription renewals: daily at midnight ────────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    await processSubscriptionRenewals()
  }, { name: 'subscription-renewals', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Low stock alerts: daily at 6:00 AM ─────────────────────────────────────
  cron.schedule('0 6 * * *', async () => {
    await sendLowStockAlerts()
  }, { name: 'low-stock-alerts', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  // ── Expired item detection: daily at 7:00 AM ───────────────────────────────
  cron.schedule('0 7 * * *', async () => {
    await markExpiredItems()
  }, { name: 'expiry-check', timezone: process.env.DEFAULT_TIMEZONE ?? 'UTC' })

  logger.info('Scheduler started — 7 jobs registered')
}

// ── Job implementations ───────────────────────────────────────────────────────

export async function sendAppointmentReminders() {
  if (!isWhatsAppConfigured()) return

  const supabase   = createAdminSupabaseClient()
  const advanceH   = parseInt(process.env.REMINDER_ADVANCE_HOURS ?? '24', 10)
  const now        = new Date()
  const targetFrom = addHours(now, advanceH - 0.25)    // 15 min window
  const targetTo   = addHours(now, advanceH + 0.25)

  const { data: appointments } = await (supabase as any)
    .from('appointments')
    .select(`
      id, start_time,
      customer:customers(name, phone),
      service:services(name),
      staff:staff(name),
      branch:branches(name)
    `)
    .eq('status', 'confirmed')
    .gte('start_time', targetFrom.toISOString())
    .lte('start_time', targetTo.toISOString())

  if (!appointments?.length) return

  for (const appt of appointments) {
    const customer = appt.customer as { name?: string; phone?: string } | null
    const service  = appt.service  as { name?: string } | null
    const staff    = appt.staff    as { name?: string } | null
    const branch   = appt.branch   as { name?: string } | null

    if (!customer?.phone) continue

    // Check if reminder already sent (prevent duplicate)
    const { data: alreadySent } = await (supabase as any)
      .from('notification_logs')
      .select('id')
      .eq('type', 'appointment_reminder')
      .eq('meta->appointment_id', appt.id)
      .single()

    if (alreadySent) continue

    try {
      await sendTemplateMessage(whatsappMessages.appointmentReminder({
        phone:     customer.phone,
        name:      customer.name ?? 'Customer',
        service:   service?.name ?? 'Service',
        date:      format(parseISO(appt.start_time), 'EEEE, MMMM d yyyy'),
        time:      format(parseISO(appt.start_time), 'h:mm a'),
        staff:     staff?.name ?? 'our stylist',
        salonName: branch?.name ?? 'LuxSalon',
      }))

      await (supabase as any).from('notification_logs').insert({
        type:     'appointment_reminder',
        channel:  'whatsapp',
        status:   'sent',
        message:  `Reminder sent for appointment ${appt.id}`,
        meta:     { appointment_id: appt.id, advance_hours: advanceH },
      })

      logger.info('Appointment reminder sent', { appointmentId: appt.id, phone: customer.phone })
    } catch (err) {
      logger.error('Failed to send appointment reminder', { appointmentId: appt.id, err })
    }
  }
}

async function runChurnDetection() {
  logger.info('Running churn detection job')
  try {
    const { data, error } = await aiService.detectChurningCustomers(100)
    if (error) throw new Error(error)
    logger.info('Churn detection complete', { detected: data?.length ?? 0 })
  } catch (err) {
    logger.error('Churn detection job failed', { err })
  }
}

async function refreshDemandForecast() {
  logger.info('Refreshing demand forecasts')
  try {
    const { data, error } = await aiService.forecastDemand(7)
    if (error) throw new Error(error)
    logger.info('Demand forecast refreshed', { days: data?.length ?? 0 })
  } catch (err) {
    logger.error('Demand forecast job failed', { err })
  }
}

async function refreshMaterializedViews() {
  logger.info('Refreshing materialized views')
  const supabase = createAdminSupabaseClient()

  try {
    await supabase.rpc('refresh_mv_daily_revenue' as never)
    await supabase.rpc('refresh_mv_service_profitability' as never)
    logger.info('Materialized views refreshed')
  } catch (err) {
    logger.warn('Materialized view refresh failed (non-critical)', { err })
  }
}

async function processSubscriptionRenewals() {
  logger.info('Processing subscription renewals')
  const supabase = createAdminSupabaseClient()
  const today    = format(new Date(), 'yyyy-MM-dd')

  const { data: dueForRenewal } = await (supabase as any)
    .from('customer_subscriptions')
    .select('*, customer:customers(name, phone, email), plan:subscription_plans(name, price_monthly)')
    .eq('status', 'active')
    .eq('next_billing', today)

  for (const sub of (dueForRenewal ?? [])) {
    logger.info('Subscription due for renewal', { subscriptionId: sub.id })
    // In production: trigger Stripe subscription billing
    // For now: extend next_billing by one month and notify customer
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    await (supabase as any).from('customer_subscriptions').update({
      next_billing: format(nextMonth, 'yyyy-MM-dd'),
    }).eq('id', (sub as any).id)
  }
}

async function sendLowStockAlerts() {
  if (!isWhatsAppConfigured()) return

  const supabase = createAdminSupabaseClient()

  const { data: items } = await (supabase as any).from('inventory')
    .select('name, quantity, min_threshold, unit, branch_id')
    .filter('quantity', 'lte', 'min_threshold')

  if (!items?.length) return

  logger.warn('Low stock detected', { itemCount: items.length, items: items.map((i: any) => i.name) })

  // Get admin phone for alerts
  const { data: admins } = await (supabase as any)
    .from('staff')
    .select('phone, name')
    .eq('role', 'admin')
    .eq('is_active', true)

  for (const admin of (admins ?? [])) {
    if (!(admin as any).phone) continue
    // Send summary alert via WhatsApp text (not template for this one)
    try {
      const { sendTextMessage } = await import('@/lib/whatsapp')
      await sendTextMessage({
        to:   (admin as any).phone,
        body: `⚠️ LuxSalon Low Stock Alert\n\n${items.map((i: any) => `• ${i.name}: ${i.quantity} ${i.unit} remaining (min: ${i.min_threshold})`).join('\n')}\n\nPlease restock soon.`,
      })
    } catch (err) {
      logger.error('Failed to send low stock alert', { err })
    }
  }
}

async function markExpiredItems() {
  const supabase = createAdminSupabaseClient()
  const today    = format(new Date(), 'yyyy-MM-dd')

  const { data: expired } = await (supabase as any)
    .from('inventory_expiry')
    .select('id')
    .lt('expiry_date', today)
    .eq('status', 'active')

  if (!expired?.length) return

  await (supabase as any).from('inventory_expiry')
    .update({ status: 'expired' })
    .in('id', expired.map((e: any) => e.id))

  logger.warn('Marked expired inventory items', { count: expired.length })
}

export function stopScheduler() {
  cron.getTasks().forEach(task => task.stop())
  schedulerStarted = false
  logger.info('Scheduler stopped')
}
