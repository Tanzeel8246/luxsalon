import { getSupabaseClient } from '@/lib/supabase'
import { addDays, format } from 'date-fns'
import type { Waitlist, ApiResponse } from '@/types'

export const customerExperienceService = {
  // ── Waitlist ─────────────────────────────────────────────────
  async addToWaitlist(payload: {
    customer_id:          string
    service_id:           string
    preferred_date?:      string
    preferred_time_start?: string
    preferred_time_end?:   string
    staff_id?:            string
    notify_via?:          Waitlist['notify_via']
  }): Promise<ApiResponse<Waitlist>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('waitlist')
      .insert({
        ...payload,
        staff_id:   payload.staff_id ?? null,
        notify_via: payload.notify_via ?? 'whatsapp',
        status:     'waiting',
        expires_at: format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm:ss"),
      })
      .select('*, customer(*), service(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getWaitlist(serviceId?: string): Promise<ApiResponse<Waitlist[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('waitlist').select('*, customer(*), service(*)')
      .eq('status', 'waiting')
      .order('created_at')
    if (serviceId) query = query.eq('service_id', serviceId)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async notifyWaitlist(waitlistId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    await supabase.from('waitlist').update({
      status:      'notified',
      notified_at: new Date().toISOString(),
    }).eq('id', waitlistId)
    return { data: undefined, error: null }
  },

  async checkCancelledSlots(): Promise<ApiResponse<Waitlist[]>> {
    const supabase = getSupabaseClient()

    const { data: recentCancellations } = await supabase
      .from('appointments')
      .select('service_id, start_time, staff_id')
      .eq('status', 'cancelled')
      .gte('start_time', new Date().toISOString())
      .order('start_time')

    if (!recentCancellations?.length) return { data: [], error: null }

    const { data: waitlistEntries } = await supabase
      .from('waitlist')
      .select('*, customer(*), service(*)')
      .eq('status', 'waiting')
      .in('service_id', recentCancellations.map(c => c.service_id))

    return { data: waitlistEntries ?? [], error: null }
  },

  // ── Self Check-in Kiosk ──────────────────────────────────────
  async kioskCheckIn(appointmentId: string): Promise<ApiResponse<{ position: number; wait_minutes: number; message: string }>> {
    const supabase = getSupabaseClient()

    const { data: appt } = await supabase
      .from('appointments')
      .select('*, customer(*), service(*)')
      .eq('id', appointmentId)
      .single() as any

    if (!appt) return { data: null, error: 'Appointment not found' }

    await supabase.from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointmentId)

    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'called', 'serving'])

    const position = (count ?? 0) + 1

    await supabase.from('queue').insert({
      customer_id:    appt.customer_id,
      service_id:     appt.service_id,
      staff_id:       appt.staff_id,
      appointment_id: appointmentId,
      position,
      estimated_wait: position * ((appt.service as { duration?: number })?.duration ?? 30),
      status:         'waiting',
    })

    await supabase.from('kiosk_sessions').insert({
      customer_id:    appt.customer_id,
      appointment_id: appointmentId,
      queue_position: position,
    })

    return {
      data: {
        position,
        wait_minutes: position * 20,
        message:      `Welcome, ${(appt.customer as { name?: string })?.name}! You're #${position} in the queue.`,
      },
      error: null,
    }
  },

  // ── Virtual Try-on ────────────────────────────────────────────
  async saveVirtualTryon(customerId: string, styleApplied: string, colorApplied: string, resultUrl?: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    await supabase.from('virtual_tryon_sessions').insert({
      customer_id:   customerId,
      style_applied: styleApplied,
      color_applied: colorApplied,
      result_url:    resultUrl ?? null,
      saved:         true,
    })
    return { data: undefined, error: null }
  },

  async getVirtualTryonHistory(customerId: string): Promise<ApiResponse<import('@/types/modules_v2').VirtualTryonSession[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('virtual_tryon_sessions').select('*')
      .eq('customer_id', customerId)
      .eq('saved', true)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Public Booking Link ──────────────────────────────────────
  async getPublicBookingConfig(slug: string): Promise<ApiResponse<{ slug: string; salon_name: string; is_active: boolean }>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('public_booking_links').select('*').eq('slug', slug).eq('is_active', true).single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async createPublicBookingLink(salonName: string, slug: string): Promise<ApiResponse<{ slug: string }>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('public_booking_links').insert({ slug, salon_name: salonName, is_active: true }).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data: { slug: data.slug }, error: null }
  },
}
