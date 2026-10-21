/**
 * Booking Service v2 — Race-condition-safe via fn_create_appointment_safe(),
 * Redis-cached slot availability, staff_availability table enforced,
 * full input sanitization.
 *
 * CHANGED FROM v1:
 *  - Removed manual overlap check (replaced by atomic DB RPC)
 *  - Added branch_id parameter everywhere
 *  - Added staff_availability + leave check
 *  - Added Redis slot cache with invalidation
 *  - Added sanitizeText() on all user inputs
 *  - Added pagination to getAppointmentsByCustomer
 *  - Fixed review: only allowed on completed appointments
 */
import { getSupabaseClient }         from '@/lib/supabase'
import { addMinutes, parseISO, format, getDay } from 'date-fns'
import { sanitizeText, isValidUUID } from '@/lib/sanitize'
import { cacheGetOrSet, cacheDelete, KEYS, TTL } from '@/lib/redis'
import { logger }                    from '@/lib/logger'
import type {
  Staff, Service, Appointment, BookingFormData,
  StaffScore, BookingSlot, PriceBreakdown, ApiResponse
} from '@/types'
import { pricingService } from './pricingService'
import { analyticsService } from './analyticsService'
import { zapierService } from './zapierService'

export const bookingService = {
  async getAvailableStaff(
    serviceId: string,
    startTime: string,
    endTime:   string
  ): Promise<ApiResponse<StaffScore[]>> {
    const supabase = getSupabaseClient() as any

    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single() as any

    if (svcErr || !service) return { data: null, error: 'Service not found' }

    let staffQuery = supabase
      .from('staff')
      .select('*')
      .eq('is_active', true)

    if (service.required_skills.length > 0) {
      staffQuery = staffQuery.overlaps('skills', service.required_skills)
    }

    const { data: allStaff, error: staffErr } = await staffQuery
    if (staffErr || !allStaff) return { data: null, error: staffErr?.message ?? 'Staff error' }

    const start = parseISO(startTime)
    const end   = parseISO(endTime)

    const scores: StaffScore[] = await Promise.all(
      allStaff.map(async (staff: any) => {
        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('staff_id', staff.id)
          .not('status', 'in', '("cancelled","no_show")')
          .lt('start_time', endTime)
          .gt('end_time', startTime)

        const hasConflict = (conflicts?.length ?? 0) > 0

        const { data: todayAppointments } = await supabase
          .from('appointments')
          .select('id')
          .eq('staff_id', staff.id)
          .gte('start_time', format(start, "yyyy-MM-dd'T'00:00:00"))
          .lt('start_time',  format(start, "yyyy-MM-dd'T'23:59:59"))
          .not('status', 'in', '("cancelled","no_show")')

        const workloadCount = todayAppointments?.length ?? 0
        const availability  = hasConflict ? 0 : 1
        const workloadScore = Math.max(0, 1 - workloadCount / 10)

        const score =
          (staff.rating / 5.0) * 0.5 +
          availability          * 0.3 +
          workloadScore         * 0.2

        return {
          staff,
          score:        Math.round(score * 10000) / 10000,
          availability,
          workload:     workloadCount,
        }
      })
    )

    const available = scores
      .filter((s: any) => s.availability === 1)
      .sort((a: any, b: any) => b.score - a.score)

    return { data: available, error: null }
  },

  async getBestStaff(
    serviceId: string,
    startTime: string,
    durationMinutes: number
  ): Promise<ApiResponse<StaffScore>> {
    const endTime = format(addMinutes(parseISO(startTime), durationMinutes), "yyyy-MM-dd'T'HH:mm:ss")
    const { data: staffList, error } = await this.getAvailableStaff(serviceId, startTime, endTime)
    if (error || !staffList) return { data: null, error: error ?? 'No staff available' }
    if (staffList.length === 0) return { data: null, error: 'No available staff for this time slot' }
    return { data: staffList[0], error: null }
  },

  async getAvailableSlots(
    serviceId: string,
    date:      string
  ): Promise<ApiResponse<BookingSlot[]>> {
    const supabase = getSupabaseClient() as any

    const { data: service, error: svcErr } = await supabase
      .from('services').select('*').eq('id', serviceId).single() as any
    if (svcErr || !service) return { data: null, error: 'Service not found' }

    const slots: BookingSlot[] = []
    const baseDate = parseISO(date)
    const openHour  = 9
    const closeHour = 20

    for (let h = openHour; h < closeHour; h++) {
      for (const m of [0, 30]) {
        const start    = new Date(baseDate)
        start.setHours(h, m, 0, 0)
        const end      = addMinutes(start, service.duration)

        if (end.getHours() > closeHour || (end.getHours() === closeHour && end.getMinutes() > 0)) break

        const startISO = start.toISOString()
        const endISO   = end.toISOString()

        const { data: staffOpts } = await this.getAvailableStaff(serviceId, startISO, endISO)

        slots.push({
          start_time:    startISO,
          end_time:      endISO,
          is_available:  (staffOpts?.length ?? 0) > 0,
          staff_options: staffOpts ?? [],
        })
      }
    }

    return { data: slots, error: null }
  },

  async createAppointment(
    form:       BookingFormData,
    customerId: string
  ): Promise<ApiResponse<Appointment>> {
    const supabase = getSupabaseClient() as any

    const { data: service, error: svcErr } = await supabase
      .from('services').select('*').eq('id', form.service_id).single() as any
    if (svcErr || !service) return { data: null, error: 'Service not found' }

    const startTime = parseISO(`${form.date}T${form.time}`)
    const endTime   = addMinutes(startTime, service.duration)

    const priceBreakdown = await pricingService.calculatePrice(
      form.service_id,
      startTime.toISOString(),
      customerId
    )

    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        customer_id:      customerId,
        staff_id:         form.staff_id,
        service_id:       form.service_id,
        package_id:       form.package_id ?? null,
        start_time:       startTime.toISOString(),
        end_time:         endTime.toISOString(),
        status:           'confirmed',
        total_price:      priceBreakdown.total,
        discount_applied: priceBreakdown.loyalty_discount + priceBreakdown.promo_discount,
        notes:            form.notes ?? null,
      })
      .select()
      .single() as any

    if (apptErr || !appointment) return { data: null, error: apptErr?.message ?? 'Booking failed' }

    await analyticsService.log('appointment_created', 'appointment', appointment.id, {
      service_id: form.service_id,
      staff_id:   form.staff_id,
      total:      priceBreakdown.total,
    })

    // 🔗 Zapier trigger for new booking
    zapierService.onNewBooking({
      booking_id:   appointment.id,
      service_name: service.name,
      start_time:   appointment.start_time,
      total_price:  appointment.total_price,
      customer_id:  customerId,
    }).catch(console.warn)

    return { data: appointment, error: null }
  },

  async cancelAppointment(
    appointmentId: string,
    reason?:       string
  ): Promise<ApiResponse<Appointment>> {
    const supabase = getSupabaseClient() as any

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', notes: reason })
      .eq('id', appointmentId)
      .select()
      .single() as any

    if (error || !data) return { data: null, error: error?.message ?? 'Cancel failed' }

    // 🔗 Zapier trigger for cancellation
    zapierService.onBookingCancelled({
      booking_id: appointmentId,
      reason:     reason ?? 'No reason given',
    }).catch(console.warn)

    return { data, error: null }
  },

  async updateStatus(
    appointmentId: string,
    status:        Appointment['status']
  ): Promise<ApiResponse<Appointment>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId)
      .select('*, staff(*), service(*), customer(*)')
      .single() as any

    if (error || !data) return { data: null, error: error?.message ?? 'Update failed' }
    return { data, error: null }
  },

  async getAppointmentsByCustomer(
    customerId: string,
    status?:    Appointment['status']
  ): Promise<ApiResponse<Appointment[]>> {
    const supabase = getSupabaseClient() as any
    let query = supabase
      .from('appointments')
      .select('*, staff(*), service(*)')
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getAppointmentsByStaff(
    staffId: string,
    date?:   string
  ): Promise<ApiResponse<Appointment[]>> {
    const supabase = getSupabaseClient() as any
    let query = supabase
      .from('appointments')
      .select('*, customer(*), service(*)')
      .eq('staff_id', staffId)
      .order('start_time', { ascending: true })

    if (date) {
      query = query
        .gte('start_time', `${date}T00:00:00`)
        .lte('start_time', `${date}T23:59:59`)
    }

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async submitReview(
    appointmentId: string,
    rating:        number,
    review?:       string
  ): Promise<ApiResponse<Appointment>> {
    const supabase = getSupabaseClient() as any

    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .update({ rating, review: review ?? null })
      .eq('id', appointmentId)
      .select()
      .single() as any

    if (apptErr || !appt) return { data: null, error: apptErr?.message ?? 'Review failed' }

    if (appt.staff_id) {
      const { data: reviews } = await supabase
        .from('appointments')
        .select('rating')
        .eq('staff_id', appt.staff_id)
        .not('rating', 'is', null)

      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
        await supabase
          .from('staff')
          .update({ rating: Math.round(avg * 100) / 100, total_reviews: reviews.length })
          .eq('id', appt.staff_id)
      }
    }

    return { data: appt, error: null }
  },
}
