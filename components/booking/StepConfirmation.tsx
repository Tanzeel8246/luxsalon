'use client'
import { useState } from 'react'
import { CheckCircle2, Calendar, Clock, User, Tag, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import { parseISO, format, addMinutes } from 'date-fns'
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/utils'
import { useBookingStore, useServices, useCreateAppointment, usePriceBreakdown } from '@/hooks/useBooking'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export function StepConfirmation({ customerId }: { customerId: string }) {
  const { formData, setStep, reset, breakdown } = useBookingStore()
  const { data: services = [] } = useServices()
  const { mutate: createAppointment, isPending } = useCreateAppointment()
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)

  const service: any = services.find((s: any) => s.id === formData.service_id)
  const startTime = formData.date && formData.time ? `${formData.date}T${formData.time}:00` : ''
  const endTime   = startTime && service ? addMinutes(parseISO(startTime), service.duration) : null

  const { data: price } = usePriceBreakdown(
    formData.service_id ?? '',
    startTime,
    customerId
  )

  const handleBook = () => {
    if (!formData.service_id || !formData.staff_id || !formData.date || !formData.time) {
      toast.error('Incomplete booking details')
      return
    }
    createAppointment(
      { form: { ...formData as Required<typeof formData>, notes }, customerId },
      {
        onSuccess: (result) => {
          if (!result.error) setDone(true)
        },
      }
    )
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 space-y-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
        >
          <CheckCircle2 size={64} className="text-green-400 mx-auto" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white">Booking Confirmed!</h2>
        <p className="text-gray-400">Your appointment has been successfully booked.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Button variant="outline" onClick={() => { reset(); setDone(false) }}>Book Another</Button>
          <Button onClick={() => window.location.href = '/dashboard'}>View Appointments</Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Review & Confirm</h2>
        <p className="text-sm text-gray-400 mt-1">Double-check your booking details</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {service && (
            <div className="flex items-start gap-3">
              <Tag size={16} className="text-gold-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="text-sm font-medium text-white">{service.name}</p>
                <p className="text-xs text-gray-400">{formatDuration(service.duration)}</p>
              </div>
            </div>
          )}

          {startTime && (
            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-gold-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="text-sm font-medium text-white">
                  {format(parseISO(startTime), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-400">
                  {format(parseISO(startTime), 'h:mm a')}
                  {endTime && ` – ${format(endTime, 'h:mm a')}`}
                </p>
              </div>
            </div>
          )}

          {formData.staff_id && (
            <div className="flex items-start gap-3">
              <User size={16} className="text-gold-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Stylist</p>
                <p className="text-sm font-medium text-white">{formData.staff_id}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price breakdown */}
      {price && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium text-white mb-3">Price Breakdown</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Base price</span>
                <span>{formatCurrency(price.base_price)}</span>
              </div>
              {price.peak_surcharge > 0 && (
                <div className="flex justify-between text-yellow-400">
                  <span>Peak hour surcharge</span>
                  <span>+{formatCurrency(price.peak_surcharge)}</span>
                </div>
              )}
              {price.demand_surcharge > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>Demand surcharge</span>
                  <span>+{formatCurrency(price.demand_surcharge)}</span>
                </div>
              )}
              {price.loyalty_discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Loyalty discount</span>
                  <span>-{formatCurrency(price.loyalty_discount)}</span>
                </div>
              )}
              {price.promo_discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Promo discount</span>
                  <span>-{formatCurrency(price.promo_discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="text-gold-400">{formatCurrency(price.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Input
        label="Notes (optional)"
        placeholder="Any special requests..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        prefix={<FileText size={14} />}
      />

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
        <Button className="flex-1" onClick={handleBook} loading={isPending}>
          Confirm Booking
        </Button>
      </div>
    </div>
  )
}
