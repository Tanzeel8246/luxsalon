'use client'
import { format, addMinutes, parseISO } from 'date-fns'
import { Star, Award, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn, formatDuration } from '@/lib/utils'
import { useBookingStore, useAvailableStaff, useServices } from '@/hooks/useBooking'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonTable } from '@/components/ui/Skeleton'

export function StepStaffSelect() {
  const { formData, setFormData, setStep } = useBookingStore()
  const { data: services = [] } = useServices()

  const service: any  = services.find((s: any) => s.id === formData.service_id)
  const startTime   = formData.date && formData.time
    ? `${formData.date}T${formData.time}:00`
    : ''
  const endTime     = startTime && service
    ? addMinutes(parseISO(startTime), service.duration).toISOString()
    : ''

  const { data: staff = [], isLoading } = useAvailableStaff(
    formData.service_id!,
    startTime,
    endTime
  )

  const handleSelect = (staffId: string) => {
    setFormData({ staff_id: staffId })
    setStep(3)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose Your Stylist</h2>
        <p className="text-sm text-gray-400 mt-1">All staff are available for your selected time</p>
      </div>

      {isLoading ? (
        <SkeletonTable rows={3} />
      ) : staff.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Award size={32} className="mx-auto mb-2 opacity-30" />
          <p>No staff available for this time slot.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep(1)}>
            Change time
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((item, i) => (
            <motion.div
              key={item.staff.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                hover
                gold={formData.staff_id === item.staff.id}
                onClick={() => handleSelect(item.staff.id)}
                className={cn(
                  'p-4 cursor-pointer',
                  formData.staff_id === item.staff.id && 'ring-1 ring-gold-500/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold-500/15 border border-gold-500/20 flex items-center justify-center shrink-0">
                    <span className="text-gold-400 font-semibold">
                      {item.staff.name.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{item.staff.name}</p>
                      {i === 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs">
                          <Zap size={10} /> Best match
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Star size={11} className="text-gold-500 fill-gold-500" />
                        {item.staff.rating.toFixed(1)} ({item.staff.total_reviews})
                      </span>
                      <span className="text-xs text-gray-500">{item.workload} appts today</span>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {item.staff.skills.slice(0, 4).map(skill => (
                        <span key={skill} className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Score</p>
                    <p className="text-lg font-bold text-gold-400">{(item.score * 100).toFixed(0)}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
      </div>
    </div>
  )
}
