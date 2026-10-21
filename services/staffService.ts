import { getSupabaseClient } from '@/lib/supabase'
import type { Staff, StaffAvailability, StaffPerformanceData, ApiResponse } from '@/types'
import { format, startOfDay, endOfDay } from 'date-fns'

export const staffService = {
  async getAll(): Promise<ApiResponse<Staff[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getById(id: string): Promise<ApiResponse<Staff>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('staff').select('*').eq('id', id).single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getByUserId(userId: string): Promise<ApiResponse<Staff>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('staff').select('*').eq('user_id', userId).single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async create(staffData: Omit<Staff, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Staff>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('staff').insert(staffData).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async update(id: string, updates: Partial<Staff>): Promise<ApiResponse<Staff>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('staff').update(updates).eq('id', id).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getAvailability(staffId: string): Promise<ApiResponse<StaffAvailability[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .order('day_of_week', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async setAvailability(
    staffId:      string,
    availability: Array<Omit<StaffAvailability, 'id' | 'staff_id'>>
  ): Promise<ApiResponse<StaffAvailability[]>> {
    const supabase = getSupabaseClient()
    await supabase.from('staff_availability').delete().eq('staff_id', staffId)

    const inserts = availability.map(a => ({ ...a, staff_id: staffId }))
    const { data, error } = await supabase.from('staff_availability').insert(inserts).select()
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getPerformance(date?: string): Promise<ApiResponse<StaffPerformanceData[]>> {
    const supabase = getSupabaseClient()
    const { data: allStaff, error: staffErr } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true)

    if (staffErr || !allStaff) return { data: null, error: staffErr?.message ?? 'Staff error' }

    const targetDate = date ?? format(new Date(), 'yyyy-MM-dd')

    const perf: StaffPerformanceData[] = await Promise.all(
      allStaff.map(async staff => {
        const { data: todayAppts } = await supabase
          .from('appointments')
          .select('status, total_price, rating')
          .eq('staff_id', staff.id)
          .gte('start_time', `${targetDate}T00:00:00`)
          .lte('start_time', `${targetDate}T23:59:59`)

        const appointments = todayAppts ?? []
        const completed    = appointments.filter(a => a.status === 'completed')
        const revenue      = completed.reduce((s, a) => s + a.total_price, 0)
        const ratings      = completed.filter(a => a.rating != null).map(a => a.rating as number)
        const avgRating    = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0
        const completionRate = appointments.length
          ? completed.length / appointments.length * 100
          : 0

        return {
          staff,
          appointments_today: appointments.length,
          revenue_today:      Math.round(revenue * 100) / 100,
          avg_rating:         Math.round(avgRating * 10) / 10,
          completion_rate:    Math.round(completionRate),
        }
      })
    )

    return { data: perf.sort((a, b) => b.revenue_today - a.revenue_today), error: null }
  },
}
