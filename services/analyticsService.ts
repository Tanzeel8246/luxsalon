import { getSupabaseClient } from '@/lib/supabase'
import { subDays, format, parseISO, eachDayOfInterval } from 'date-fns'
import type { DashboardStats, RevenueDataPoint, PeakHourData, ApiResponse } from '@/types'

export const analyticsService = {
  async log(
    eventType:  string,
    entityType: string,
    entityId:   string,
    data:       Record<string, unknown> = {}
  ): Promise<void> {
    const supabase = getSupabaseClient() as any
    await supabase.from('analytics_logs').insert({ event_type: eventType, entity_type: entityType, entity_id: entityId, data })
  },

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const supabase = getSupabaseClient() as any
    const today      = format(new Date(), 'yyyy-MM-dd')
    const yesterday  = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const [
      { data: todayAppts },
      { data: yesterdayAppts },
      { data: queueActive },
      { data: activeStaff },
    ] = await Promise.all([
      supabase
        .from('appointments')
        .select('total_price, status, rating')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`),
      supabase
        .from('appointments')
        .select('total_price')
        .gte('start_time', `${yesterday}T00:00:00`)
        .lte('start_time', `${yesterday}T23:59:59`)
        .in('status', ['completed']),
      supabase
        .from('queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['waiting', 'called', 'serving']),
      supabase
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ])

    const todayRevenue    = (todayAppts ?? [])
      .filter((a: any) => a.status === 'completed')
      .reduce((s: number, a: any) => s + a.total_price, 0)
    const yesterdayRevenue = (yesterdayAppts ?? []).reduce((s: number, a: any) => s + a.total_price, 0)
    const revenueGrowth    = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0

    const ratings = (todayAppts ?? [])
      .filter((a: any) => a.rating != null)
      .map((a: any) => a.rating as number)
    const avgRating = ratings.length
      ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length
      : 0

    return {
      data: {
        total_revenue:      Math.round(todayRevenue * 100) / 100,
        today_appointments: todayAppts?.length ?? 0,
        active_staff:       activeStaff?.length ?? 0,
        queue_count:        queueActive?.length ?? 0,
        revenue_growth:     Math.round(revenueGrowth * 10) / 10,
        avg_rating:         Math.round(avgRating * 10) / 10,
      },
      error: null,
    }
  },

  async getRevenueChart(days = 30): Promise<ApiResponse<RevenueDataPoint[]>> {
    const supabase  = getSupabaseClient() as any
    const startDate = subDays(new Date(), days)
    const endDate   = new Date()

    const { data, error } = await supabase
      .from('appointments')
      .select('start_time, total_price')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .in('status', ['completed'])

    if (error) return { data: null, error: error.message }

    const byDate: Record<string, { revenue: number; count: number }> = {}

    eachDayOfInterval({ start: startDate, end: endDate }).forEach(d => {
      byDate[format(d, 'yyyy-MM-dd')] = { revenue: 0, count: 0 }
    })

    ;(data ?? []).forEach((appt: any) => {
      const day = format(parseISO(appt.start_time), 'yyyy-MM-dd')
      if (byDate[day]) {
        byDate[day].revenue += appt.total_price
        byDate[day].count   += 1
      }
    })

    const result: RevenueDataPoint[] = Object.entries(byDate).map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue * 100) / 100,
      count:   v.count,
    }))

    return { data: result, error: null }
  },

  async getPeakHours(days = 30): Promise<ApiResponse<PeakHourData[]>> {
    const supabase = getSupabaseClient() as any

    const { data, error } = await supabase
      .from('appointments')
      .select('start_time, total_price')
      .gte('start_time', subDays(new Date(), days).toISOString())
      .in('status', ['completed', 'confirmed'])

    if (error) return { data: null, error: error.message }

    const byHour: Record<number, { count: number; revenue: number }> = {}
    for (let h = 0; h < 24; h++) byHour[h] = { count: 0, revenue: 0 }

    ;(data ?? []).forEach((appt: any) => {
      const hour = parseISO(appt.start_time).getHours()
      byHour[hour].count++
      byHour[hour].revenue += appt.total_price
    })

    const result: PeakHourData[] = Object.entries(byHour)
      .filter(([, v]) => v.count > 0)
      .map(([h, v]) => ({
        hour:              Number(h),
        appointment_count: v.count,
        revenue:           Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => a.hour - b.hour)

    return { data: result, error: null }
  },
}
