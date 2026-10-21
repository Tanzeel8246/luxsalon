import { getSupabaseClient } from '@/lib/supabase'
import { addDays, addWeeks, addMonths, format, parseISO, isWeekend, isBefore, isAfter } from 'date-fns'
import type { RecurringAppointment, GroupBooking, StaffLeave, StaffShift, HolidayCalendar, Resource, ApiResponse } from '@/types'

export const schedulingService = {
  // ── Recurring Appointments ──────────────────────────────────
  async createRecurring(recurring: Omit<RecurringAppointment, 'id' | 'completed_count' | 'last_created' | 'created_at'>): Promise<ApiResponse<RecurringAppointment>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('recurring_appointments')
      .insert({ ...recurring, completed_count: 0 })
      .select('*, customer(*), service(*), staff(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getRecurringForCustomer(customerId: string): Promise<ApiResponse<RecurringAppointment[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select('*, service(*), staff(*)')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('start_date')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async generateNextRecurringDates(recurringId: string, count = 5): Promise<string[]> {
    const supabase = getSupabaseClient()
    const { data: recurring } = await supabase
      .from('recurring_appointments').select('*').eq('id', recurringId).single() as any
    if (!recurring) return []

    const dates: string[] = []
    let base = recurring.last_created
      ? addDays(parseISO(recurring.last_created), 1)
      : parseISO(recurring.start_date)

    const holidays = await this.getHolidays()
    const holidayDates = new Set((holidays.data ?? []).filter(h => h.is_closed).map(h => h.date))

    while (dates.length < count) {
      const dateStr = format(base, 'yyyy-MM-dd')

      if (recurring.end_date && isAfter(base, parseISO(recurring.end_date))) break
      if (recurring.occurrences && recurring.completed_count + dates.length >= recurring.occurrences) break
      if (!holidayDates.has(dateStr)) {
        if (recurring.day_of_week === undefined || base.getDay() === recurring.day_of_week) {
          dates.push(dateStr)
        }
      }

      switch (recurring.frequency) {
        case 'weekly':    base = addDays(base, 7);  break
        case 'biweekly':  base = addDays(base, 14); break
        case 'monthly':   base = addMonths(base, 1); break
        case 'custom':    base = addDays(base, recurring.interval_days ?? 7); break
      }
    }

    return dates
  },

  // ── Group Bookings ──────────────────────────────────────────
  async createGroupBooking(booking: Omit<GroupBooking, 'id' | 'created_at' | 'members'>): Promise<ApiResponse<GroupBooking>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('group_bookings')
      .insert(booking)
      .select('*, organizer:customers(*), service:services(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getGroupBookings(status?: GroupBooking['status']): Promise<ApiResponse<GroupBooking[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('group_bookings')
      .select('*, organizer:customers(*), service:services(*)')
      .order('date', { ascending: true })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Resources ───────────────────────────────────────────────
  async getResources(branchId?: string): Promise<ApiResponse<Resource[]>> {
    const supabase = getSupabaseClient()
    let query = supabase.from('resources').select('*').eq('is_active', true)
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getResourceAvailability(resourceId: string, date: string): Promise<{
    resource_id: string
    date:        string
    booked_slots: Array<{ start: string; end: string }>
    free_slots:   Array<{ start: string; end: string }>
  }> {
    const supabase = getSupabaseClient()
    const { data: bookings } = await supabase
      .from('resource_bookings')
      .select('start_time, end_time')
      .eq('resource_id', resourceId)
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`)
      .order('start_time')

    const bookedSlots = (bookings ?? []).map(b => ({ start: b.start_time, end: b.end_time }))
    const freeSlots: Array<{ start: string; end: string }> = []

    let cursor = `${date}T09:00:00`
    const closing = `${date}T20:00:00`

    for (const slot of bookedSlots) {
      if (cursor < slot.start) freeSlots.push({ start: cursor, end: slot.start })
      cursor = slot.end
    }
    if (cursor < closing) freeSlots.push({ start: cursor, end: closing })

    return { resource_id: resourceId, date, booked_slots: bookedSlots, free_slots: freeSlots }
  },

  // ── Staff Leaves ────────────────────────────────────────────
  async requestLeave(leave: Omit<StaffLeave, 'id' | 'status' | 'approved_by' | 'approved_at' | 'created_at'>): Promise<ApiResponse<StaffLeave>> {
    const supabase = getSupabaseClient()

    const { data: conflicts } = await supabase
      .from('appointments').select('id')
      .eq('staff_id', leave.staff_id)
      .gte('start_time', `${leave.start_date}T00:00:00`)
      .lte('start_time', `${leave.end_date}T23:59:59`)
      .not('status', 'in', '("cancelled","no_show")')

    if (conflicts && conflicts.length > 0) {
      return { data: null, error: `${conflicts.length} appointment(s) conflict with this leave period` }
    }

    const { data, error } = await supabase
      .from('staff_leaves').insert({ ...leave, status: 'pending' })
      .select('*, staff(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async approveLeave(leaveId: string, approvedBy: string, approved: boolean): Promise<ApiResponse<StaffLeave>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff_leaves')
      .update({
        status:      approved ? 'approved' : 'rejected',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', leaveId)
      .select('*, staff(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getLeaves(staffId?: string, status?: StaffLeave['status']): Promise<ApiResponse<StaffLeave[]>> {
    const supabase = getSupabaseClient()
    let query = supabase.from('staff_leaves').select('*, staff(*)').order('start_date', { ascending: false })
    if (staffId) query = query.eq('staff_id', staffId)
    if (status)  query = query.eq('status', status)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Shifts ──────────────────────────────────────────────────
  async setShift(shift: Omit<StaffShift, 'id' | 'swap_status' | 'overtime_hours' | 'created_at'>): Promise<ApiResponse<StaffShift>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff_shifts')
      .upsert({ ...shift, swap_status: 'none', overtime_hours: 0 }, { onConflict: 'staff_id,date' })
      .select('*, staff(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getShiftsForWeek(weekStart: string, branchId?: string): Promise<ApiResponse<StaffShift[]>> {
    const supabase = getSupabaseClient()
    const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd')
    let query = supabase.from('staff_shifts').select('*, staff(*)')
      .gte('date', weekStart).lte('date', weekEnd).order('date').order('staff_id')
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async requestShiftSwap(shiftId: string, swapWithStaffId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    await supabase.from('staff_shifts').update({ swap_with: swapWithStaffId, swap_status: 'requested' }).eq('id', shiftId)
    return { data: undefined, error: null }
  },

  // ── Holiday Calendar ─────────────────────────────────────────
  async getHolidays(branchId?: string): Promise<ApiResponse<HolidayCalendar[]>> {
    const supabase = getSupabaseClient()
    let query = supabase.from('holiday_calendar').select('*').order('date')
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async addHoliday(holiday: Omit<HolidayCalendar, 'id' | 'created_at'>): Promise<ApiResponse<HolidayCalendar>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('holiday_calendar').insert(holiday).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async isHoliday(date: string, branchId?: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    let query = supabase.from('holiday_calendar').select('id').eq('date', date).eq('is_closed', true)
    if (branchId) query = query.eq('branch_id', branchId)
    const { data } = await query.single() as any
    return !!data
  },
}
