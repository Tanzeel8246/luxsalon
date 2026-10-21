'use client'
import { useState } from 'react'
import { format, addDays, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn, formatTime } from '@/lib/utils'
import { useBookingStore, useAvailableSlots } from '@/hooks/useBooking'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

export function StepDateTime() {
  const { formData, setFormData, setStep } = useBookingStore()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: slots = [], isLoading } = useAvailableSlots(formData.service_id!, dateStr)

  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))

  const availableSlots = slots.filter(s => s.is_available)

  const handleSlotSelect = (startTime: string, time: string) => {
    setFormData({ date: dateStr, time })
    setStep(2)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Pick a Date & Time</h2>
        <p className="text-sm text-gray-400 mt-1">Choose your preferred slot</p>
      </div>

      {/* Date picker */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-3">Select Date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {days.map(day => {
            const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
            const today      = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
            return (
              <motion.button
                key={day.toISOString()}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex flex-col items-center min-w-[60px] px-3 py-3 rounded-xl border transition-all',
                  isSelected
                    ? 'bg-gold-500/20 border-gold-500/50 text-gold-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                )}
              >
                <span className="text-xs font-medium">{format(day, 'EEE')}</span>
                <span className="text-lg font-bold mt-0.5">{format(day, 'd')}</span>
                {today && <span className="text-xs mt-0.5 opacity-70">Today</span>}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-300">Available Slots</p>
          <span className="text-xs text-gray-500">{availableSlots.length} available</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Clock size={32} className="mx-auto mb-2 opacity-30" />
            <p>No available slots for this date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {slots.map(slot => {
              const timeStr = format(new Date(slot.start_time), 'HH:mm')
              const isSelected = formData.time === timeStr && formData.date === dateStr
              return (
                <motion.button
                  key={slot.start_time}
                  whileTap={{ scale: 0.95 }}
                  disabled={!slot.is_available}
                  onClick={() => handleSlotSelect(slot.start_time, timeStr)}
                  className={cn(
                    'px-2 py-2.5 rounded-lg text-xs font-medium border transition-all',
                    !slot.is_available && 'opacity-25 cursor-not-allowed bg-white/3 border-white/5 text-gray-600',
                    slot.is_available && isSelected && 'bg-gold-500/25 border-gold-500/60 text-gold-400',
                    slot.is_available && !isSelected && 'bg-white/5 border-white/10 text-gray-300 hover:border-gold-500/30 hover:text-white'
                  )}
                >
                  {formatTime(new Date(slot.start_time))}
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
      </div>
    </div>
  )
}
