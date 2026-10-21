'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import toast from 'react-hot-toast'
import { bookingService } from '@/services/bookingService'
import { pricingService } from '@/services/pricingService'
import type { BookingFormData, PriceBreakdown } from '@/types'

interface BookingStore {
  step:        number
  formData:    Partial<BookingFormData>
  breakdown:   PriceBreakdown | null
  setStep:     (s: number) => void
  setFormData: (d: Partial<BookingFormData>) => void
  setBreakdown: (b: PriceBreakdown | null) => void
  reset:       () => void
}

export const useBookingStore = create<BookingStore>((set) => ({
  step:        0,
  formData:    {},
  breakdown:   null,
  setStep:     (step)      => set({ step }),
  setFormData: (formData)  => set((s) => ({ formData: { ...s.formData, ...formData } })),
  setBreakdown: (breakdown) => set({ breakdown }),
  reset: () => set({ step: 0, formData: {}, breakdown: null }),
}))

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn:  async () => {
      const { getSupabaseClient } = await import('@/lib/supabase')
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useAvailableSlots(serviceId: string, date: string) {
  return useQuery({
    queryKey: ['slots', serviceId, date],
    queryFn:  async () => {
      const { data, error } = await bookingService.getAvailableSlots(serviceId, date)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled:   !!serviceId && !!date,
    staleTime: 1000 * 60 * 2,
  })
}

export function useAvailableStaff(serviceId: string, startTime: string, endTime: string) {
  return useQuery({
    queryKey: ['staff-available', serviceId, startTime, endTime],
    queryFn:  async () => {
      const { data, error } = await bookingService.getAvailableStaff(serviceId, startTime, endTime)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled:   !!serviceId && !!startTime && !!endTime,
  })
}

export function usePriceBreakdown(serviceId: string, startTime: string, customerId: string) {
  return useQuery({
    queryKey: ['price', serviceId, startTime, customerId],
    queryFn:  () => pricingService.calculatePrice(serviceId, startTime, customerId),
    enabled:  !!serviceId && !!startTime && !!customerId,
  })
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ form, customerId }: { form: BookingFormData; customerId: string }) =>
      bookingService.createAppointment(form, customerId),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      toast.success('Appointment booked successfully!')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useMyAppointments(customerId: string) {
  return useQuery({
    queryKey: ['appointments', customerId],
    queryFn:  async () => {
      const { data, error } = await bookingService.getAppointmentsByCustomer(customerId)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled: !!customerId,
  })
}

export function useCancelAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      bookingService.cancelAppointment(id, reason),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment cancelled.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
