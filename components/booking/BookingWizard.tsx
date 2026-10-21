'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookingStore } from '@/hooks/useBooking'
import { StepServiceSelect } from './StepServiceSelect'
import { StepDateTime }      from './StepDateTime'
import { StepStaffSelect }   from './StepStaffSelect'
import { StepConfirmation }  from './StepConfirmation'

const STEPS = [
  { label: 'Service',      desc: 'Choose a service' },
  { label: 'Date & Time',  desc: 'Pick a slot' },
  { label: 'Staff',        desc: 'Select your stylist' },
  { label: 'Confirm',      desc: 'Review & book' },
]

export function BookingWizard({ customerId }: { customerId: string }) {
  const { step } = useBookingStore()

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  backgroundColor: i < step ? 'rgb(212,175,55)' : i === step ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                  borderColor:     i <= step ? 'rgb(212,175,55)' : 'rgba(255,255,255,0.1)',
                }}
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold"
              >
                {i < step ? (
                  <CheckCircle2 size={18} className="text-obsidian-950" />
                ) : (
                  <span className={i === step ? 'text-gold-400' : 'text-gray-500'}>{i + 1}</span>
                )}
              </motion.div>
              <div className="text-center hidden sm:block">
                <p className={cn('text-xs font-medium', i <= step ? 'text-gold-400' : 'text-gray-500')}>{s.label}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <motion.div
                animate={{ backgroundColor: i < step ? 'rgb(212,175,55)' : 'rgba(255,255,255,0.1)' }}
                className="flex-1 h-0.5 mx-3"
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && <StepServiceSelect />}
          {step === 1 && <StepDateTime />}
          {step === 2 && <StepStaffSelect />}
          {step === 3 && <StepConfirmation customerId={customerId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
