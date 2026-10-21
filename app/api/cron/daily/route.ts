/**
 * Vercel Cron — Daily Jobs
 * Runs at 2:00 AM via vercel.json crons config.
 * Runs: churn detection, demand forecast, MV refresh, subscription renewals
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger }                    from '@/lib/logger'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}
  const supabase = createAdminSupabaseClient()

  // 1. Churn detection
  try {
    const { aiService } = await import('@/services/aiService')
    const { data } = await aiService.detectChurningCustomers(100)
    results.churn = `${data?.length ?? 0} customers`
  } catch (err) { results.churn = `ERROR: ${err}` }

  // 2. Demand forecast
  try {
    const { aiService } = await import('@/services/aiService')
    await aiService.forecastDemand(7)
    results.forecast = 'refreshed'
  } catch (err) { results.forecast = `ERROR: ${err}` }

  // 3. Materialized views
  try {
    await supabase.rpc('refresh_mv_daily_revenue' as never)
    await supabase.rpc('refresh_mv_service_profitability' as never)
    await supabase.rpc('refresh_mv_customer_ltv' as never)
    results.materialized_views = 'refreshed'
  } catch (err) { results.materialized_views = `WARN: ${err}` }

  // 4. Mark expired inventory
  try {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await (supabase as any)
      .from('inventory_expiry')
      .update({ status: 'expired' })
      .lt('expiry_date', today)
      .eq('status', 'active')
      .select('*', { count: 'exact', head: true })
    results.expired_items = `${count ?? 0} marked`
  } catch (err) { results.expired_items = `ERROR: ${err}` }

  // 5. Low stock alerts
  try {
    const { data: lowStock } = await supabase
      .from('inventory')
      .select('name, quantity, min_threshold')
      .filter('quantity', 'lte', 'min_threshold')
    results.low_stock = `${lowStock?.length ?? 0} items`
  } catch (err) { results.low_stock = `ERROR: ${err}` }

  logger.info('Daily cron completed', results)
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), results })
}
