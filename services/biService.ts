import { getSupabaseClient } from '@/lib/supabase'
import { subDays, format, parseISO, eachMonthOfInterval, startOfMonth } from 'date-fns'
import type { ApiResponse } from '@/types'

export const biService = {
  // ── Customer LTV & Segmentation ──────────────────────────────
  async getCustomerLTV(limit = 20): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('customer_ltv')
      .select('*, customer(*)')
      .order('total_spent', { ascending: false })
      .limit(limit)

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getLTVSegments(): Promise<ApiResponse<Record<string, { count: number; avg_ltv: number; total_revenue: number }>>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('customer_ltv')
      .select('clv_segment, total_spent')

    if (error) return { data: null, error: error.message }

    const segments: Record<string, { count: number; total: number }> = {
      champion: { count: 0, total: 0 },
      loyal:    { count: 0, total: 0 },
      at_risk:  { count: 0, total: 0 },
      lost:     { count: 0, total: 0 },
      new:      { count: 0, total: 0 },
    }

    ;(data ?? []).forEach((row: any) => {
      const seg = row.clv_segment ?? 'new'
      if (segments[seg]) {
        segments[seg].count++
        segments[seg].total += row.total_spent
      }
    })

    const result: Record<string, { count: number; avg_ltv: number; total_revenue: number }> = {}
    Object.entries(segments).forEach(([seg, v]) => {
      result[seg] = {
        count:         v.count,
        avg_ltv:       v.count ? Math.round((v.total / v.count) * 100) / 100 : 0,
        total_revenue: Math.round(v.total * 100) / 100,
      }
    })

    return { data: result, error: null }
  },

  // ── Service Profitability ────────────────────────────────────
  async getServiceProfitability(): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient() as any

    try {
      const { data, error } = await supabase
        .from('mv_service_profitability')
        .select('*')
        .order('total_revenue', { ascending: false })

      if (!error && data) return { data, error: null }
    } catch {}

    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)

    if (error || !services) return { data: null, error: error?.message ?? 'Error' }

    const profitability: any[] = await Promise.all(
      services.map(async (s: any) => {
        const { data: appts } = await supabase
          .from('appointments')
          .select('total_price, rating')
          .eq('service_id', s.id)
          .eq('status', 'completed')

        const total    = (appts ?? []).reduce((sum: number, a: any) => sum + a.total_price, 0)
        const avgRev   = appts?.length ? total / appts.length : 0
        const ratings  = (appts ?? []).filter((a: any) => a.rating).map((a: any) => a.rating as number)
        const avgRat   = ratings.length ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0

        return {
          id:                 s.id,
          name:               s.name,
          category:           s.category,
          base_price:         s.base_price,
          duration:           s.duration,
          total_bookings:     appts?.length ?? 0,
          total_revenue:      Math.round(total * 100) / 100,
          avg_revenue:        Math.round(avgRev * 100) / 100,
          avg_rating:         Math.round(avgRat * 10) / 10,
          revenue_per_minute: s.duration ? Math.round((avgRev / s.duration) * 100) / 100 : 0,
        }
      })
    )

    return {
      data: profitability.sort((a: any, b: any) => b.total_revenue - a.total_revenue),
      error: null,
    }
  },

  // ── Revenue Trend (Monthly) ──────────────────────────────────
  async getMonthlyRevenueTrend(months = 12): Promise<ApiResponse<{ month: string; revenue: number; appointments: number; growth: number }[]>> {
    const supabase  = getSupabaseClient() as any
    const startDate = subDays(new Date(), months * 30)

    const { data, error } = await supabase
      .from('appointments')
      .select('start_time, total_price')
      .gte('start_time', startDate.toISOString())
      .eq('status', 'completed')

    if (error) return { data: null, error: error.message }

    const byMonth: Record<string, { revenue: number; count: number }> = {}

    eachMonthOfInterval({ start: startDate, end: new Date() }).forEach(m => {
      byMonth[format(m, 'yyyy-MM')] = { revenue: 0, count: 0 }
    })

    ;(data ?? []).forEach((a: any) => {
      const key = format(parseISO(a.start_time), 'yyyy-MM')
      if (byMonth[key]) {
        byMonth[key].revenue += a.total_price
        byMonth[key].count++
      }
    })

    const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
    const result = entries.map(([month, v], i) => {
      const prev = i > 0 ? entries[i - 1][1].revenue : 0
      const growth = prev > 0 ? ((v.revenue - prev) / prev) * 100 : 0
      return {
        month,
        revenue:      Math.round(v.revenue * 100) / 100,
        appointments: v.count,
        growth:       Math.round(growth * 10) / 10,
      }
    })

    return { data: result, error: null }
  },

  // ── KPI vs Target ────────────────────────────────────────────
  async getKPIVsTarget(): Promise<ApiResponse<Array<{
    metric:  string
    actual:  number
    target:  number
    pct:     number
    status:  'above' | 'on_track' | 'below'
  }>>> {
    const supabase = getSupabaseClient() as any
    const today    = format(new Date(), 'yyyy-MM-dd')
    const month    = format(new Date(), 'yyyy-MM')

    const [
      { data: targets },
      { data: todayAppts },
    ] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('period', 'daily'),
      supabase
        .from('appointments')
        .select('total_price, status')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`),
    ])

    const todayRevenue = (todayAppts ?? [])
      .filter((a: any) => a.status === 'completed')
      .reduce((s: number, a: any) => s + a.total_price, 0)

    const kpiMap: Record<string, number> = {
      daily_revenue:      todayRevenue,
      daily_appointments: todayAppts?.length ?? 0,
    }

    const result = (targets ?? []).map((t: any) => {
      const actual = kpiMap[t.metric_name] ?? 0
      const pct    = t.target_value > 0 ? (actual / t.target_value) * 100 : 0
      return {
        metric: t.metric_name,
        actual: Math.round(actual * 100) / 100,
        target: t.target_value,
        pct:    Math.round(pct),
        status: pct >= 100 ? 'above' : pct >= 80 ? 'on_track' : 'below',
      } as const
    })

    return { data: result, error: null }
  },

  // ── Real-time Hourly Revenue ─────────────────────────────────
  async getHourlyRevenue(date?: string): Promise<ApiResponse<Array<{ hour: number; revenue: number; count: number }>>> {
    const supabase = getSupabaseClient() as any
    const d = date ?? format(new Date(), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('appointments')
      .select('start_time, total_price')
      .gte('start_time', `${d}T00:00:00`)
      .lte('start_time', `${d}T23:59:59`)
      .eq('status', 'completed')

    if (error) return { data: null, error: error.message }

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }))
    ;(data ?? []).forEach((a: any) => {
      const h = parseISO(a.start_time).getHours()
      byHour[h].revenue += a.total_price
      byHour[h].count++
    })

    return { data: byHour.filter(h => h.count > 0), error: null }
  },

  async refreshMaterializedViews(): Promise<void> {
    const supabase = getSupabaseClient() as any
    await supabase.rpc('refresh_materialized_views' as never)
  },
}
