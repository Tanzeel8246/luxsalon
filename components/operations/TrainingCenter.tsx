'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Play, CheckCircle, Award, Clock, AlertTriangle, BookOpen } from 'lucide-react'
import { operationsService } from '@/services/operationsService'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
// import type { TrainingModule } from '@/types'

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  onboarding:       { icon: '🎉', color: 'text-green-400' },
  skills:           { icon: '✂️',  color: 'text-gold-400' },
  safety:           { icon: '🦺', color: 'text-red-400' },
  compliance:       { icon: '📜', color: 'text-blue-400' },
  product:          { icon: '🧴', color: 'text-purple-400' },
  customer_service: { icon: '💬', color: 'text-yellow-400' },
}

export function TrainingCenter({ staffId }: { staffId: string }) {
  const qc = useQueryClient()

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['training-modules'],
    queryFn:  async () => {
      const { data, error } = await operationsService.getTrainingModules()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: progress } = useQuery({
    queryKey: ['training-progress', staffId],
    queryFn:  async () => {
      const { data, error } = await operationsService.getStaffTrainingProgress(staffId)
      if (error) throw new Error(error)
      return data
    },
    enabled: !!staffId,
  })

  const enrollMutation = useMutation({
    mutationFn: (moduleId: string) => operationsService.enrollStaff(staffId, moduleId, 'admin'),
    onSuccess:  (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['training-progress', staffId] })
      toast.success('Enrolled in module!')
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
            <BookOpen size={18} className="text-gold-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Training Center</h3>
            {progress && (
              <p className="text-xs text-gray-500 mt-0.5">
                {progress.completed}/{progress.total} modules · {progress.pct}% complete
                {progress.overdue > 0 && <span className="text-red-400 ml-1">· {progress.overdue} overdue</span>}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {progress && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total',       value: progress.total,       color: 'text-white' },
              { label: 'Completed',   value: progress.completed,   color: 'text-green-400' },
              { label: 'In Progress', value: progress.in_progress, color: 'text-blue-400' },
              { label: 'Overdue',     value: progress.overdue,     color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : modules.map((mod: any, i: number) => {
            const cfg = CATEGORY_CONFIG[mod.category]
            return (
              <motion.div key={mod.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 p-3.5 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{mod.title}</p>
                    {mod.is_mandatory && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/15 text-red-400 border border-red-500/25 shrink-0">Required</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn('text-xs', cfg.color)}>{mod.category.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={10} />{mod.duration_mins}m
                    </span>
                    <span className="text-xs text-gray-500">Pass: {mod.passing_score}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400 border border-white/8">
                    {mod.content_type}
                  </span>
                  <Button size="sm" variant="outline" icon={<Play size={11} />}
                    loading={enrollMutation.isPending}
                    onClick={() => enrollMutation.mutate(mod.id)}>
                    Enroll
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
