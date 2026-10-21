'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square, AlertCircle, Camera, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { operationsService } from '@/services/operationsService'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
// import type { Checklist, ChecklistItem } from '@/types'

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  opening:     { label: 'Opening',     icon: '🌅', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  closing:     { label: 'Closing',     icon: '🌙', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  service:     { label: 'Service',     icon: '✂️',  color: 'bg-gold-500/15 text-gold-400 border-gold-500/25' },
  safety:      { label: 'Safety',      icon: '🦺', color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  cleaning:    { label: 'Cleaning',    icon: '🧹', color: 'bg-green-500/15 text-green-400 border-green-500/25' },
  maintenance: { label: 'Maintenance', icon: '🔧', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
}

export function SOPChecklist({ staffId }: { staffId: string }) {
  const qc = useQueryClient()
  const [checked, setChecked]       = useState<Record<string, Set<string>>>({})
  const [activeList, setActiveList] = useState<string | null>(null)

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn:  async () => {
      const { data, error } = await operationsService.getChecklists()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: completions = [] } = useQuery({
    queryKey: ['checklist-completions-today'],
    queryFn:  async () => {
      const { data, error } = await operationsService.getTodayCompletions()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const toggleItem = (checklistId: string, itemId: string) => {
    setChecked(prev => {
      const set = new Set(prev[checklistId] ?? [])
      set.has(itemId) ? set.delete(itemId) : set.add(itemId)
      return { ...prev, [checklistId]: set }
    })
  }

  const submitMutation = useMutation({
    mutationFn: (checklist: any) => {
      const done  = checked[checklist.id]?.size ?? 0
      const total = checklist.items?.length ?? 0
      return operationsService.submitCompletion({
        checklist_id: checklist.id,
        completed_by: staffId,
        items_done:   done,
        items_total:  total,
      })
    },
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['checklist-completions-today'] })
      toast.success(`Checklist submitted — ${result.data?.pct_complete}% complete`)
    },
  })

  const isCompleted = (checklistId: string) =>
    completions.some(c => c.checklist_id === checklistId)

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-white">SOP Checklists</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {completions.length}/{checklists.length} completed today
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {checklists.map((cl, i) => {
          const cfg         = TYPE_CONFIG[cl.type]
          const done        = checked[cl.id]?.size ?? 0
          const total       = cl.items?.length ?? 0
          const pct         = total ? Math.round((done / total) * 100) : 0
          const completed   = isCompleted(cl.id)
          const isActive    = activeList === cl.id

          return (
            <motion.div key={cl.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <div
                className={cn(
                  'rounded-xl border transition-all overflow-hidden',
                  completed ? 'border-green-500/25 bg-green-500/4' : 'border-white/8 bg-white/2 hover:border-white/12'
                )}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 p-3.5 cursor-pointer"
                  onClick={() => setActiveList(isActive ? null : cl.id)}
                >
                  <span className="text-base">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{cl.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-500">{total} items</span>
                    </div>
                  </div>
                  {completed ? (
                    <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-white">{pct}%</p>
                      <div className="w-12 h-1 bg-white/10 rounded-full mt-1">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Items */}
                {isActive && !completed && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-white/8 overflow-hidden"
                  >
                    <div className="p-3 space-y-1.5">
                      {(cl.items ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map((item: any) => {
                        const isChecked = checked[cl.id]?.has(item.id) ?? false
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(cl.id, item.id)}
                            className={cn(
                              'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all',
                              isChecked ? 'bg-green-500/8 border border-green-500/20' : 'hover:bg-white/4'
                            )}
                          >
                            {isChecked
                              ? <CheckSquare size={15} className="text-green-400 shrink-0" />
                              : <Square size={15} className="text-gray-500 shrink-0" />
                            }
                            <span className={cn('text-xs', isChecked ? 'text-gray-400 line-through' : 'text-white')}>
                              {item.item}
                            </span>
                            {item.is_critical && <AlertCircle size={11} className="text-red-400 ml-auto shrink-0" />}
                            {item.photo_required && <Camera size={11} className="text-blue-400 shrink-0" />}
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-3 pb-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        loading={submitMutation.isPending}
                        onClick={e => { e.stopPropagation(); submitMutation.mutate(cl) }}
                      >
                        Submit ({done}/{total} done)
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
        {checklists.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No checklists configured.</p>
        )}
      </CardContent>
    </Card>
  )
}
