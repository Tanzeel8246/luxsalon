'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Flag, Clock, CheckCircle, MoreHorizontal } from 'lucide-react'
import { operationsService } from '@/services/operationsService'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import toast from 'react-hot-toast'
// import type { Task } from '@/types'

const COLUMNS: { key: any; label: string; color: string; dot: string }[] = [
  { key: 'todo',        label: 'To Do',       color: 'bg-gray-500/15 text-gray-400',   dot: 'bg-gray-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500/15 text-blue-400',   dot: 'bg-blue-500 animate-pulse' },
  { key: 'review',      label: 'Review',      color: 'bg-yellow-500/15 text-yellow-400',dot: 'bg-yellow-500' },
  { key: 'done',        label: 'Done',        color: 'bg-green-500/15 text-green-400', dot: 'bg-green-500' },
]

const PRIORITY_CONFIG = {
  urgent: { color: 'text-red-400',    bg: 'bg-red-500/15',    icon: '🔴' },
  high:   { color: 'text-orange-400', bg: 'bg-orange-500/15', icon: '🟠' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: '🟡' },
  low:    { color: 'text-gray-400',   bg: 'bg-gray-500/10',   icon: '⚪' },
}

const CATEGORY_ICONS: Record<string, string> = {
  cleaning: '🧹', maintenance: '🔧', admin: '📋', training: '🎓', other: '📌',
}

export function TaskBoard() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as any,
    category: 'other' as any, due_date: '', tags: [] as string[],
  })

  const { data: tasksByStatus = {}, isLoading } = useQuery({
    queryKey: ['tasks-board'],
    queryFn:  async () => {
      const { data, error } = await operationsService.getTasksByStatus()
      if (error) throw new Error(error)
      return data ?? {}
    },
    refetchInterval: 30000,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) =>
      operationsService.updateTaskStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks-board'] }),
  })

  const createMutation = useMutation({
    mutationFn: () => operationsService.createTask({
      title:        form.title,
      description:  form.description || null,
      priority:     form.priority,
      category:     form.category,
      status:       'todo',
      due_date:     form.due_date || null,
      tags:         form.tags,
      assigned_to:  null,
      created_by:   null,
      branch_id:    null,
      recurrence:   null,
    }),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['tasks-board'] })
      setShowCreate(false)
      toast.success('Task created!')
    },
  })

  const totalTasks    = Object.values(tasksByStatus).flat().length
  const doneTasks     = (tasksByStatus['done'] ?? []).length
  const urgentTasks   = Object.values(tasksByStatus).flat().filter(t => t.priority === 'urgent').length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Task Board</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {doneTasks}/{totalTasks} done · {urgentTasks} urgent
              </p>
            </div>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Task</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMNS.map(col => (
              <div key={col.key} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                  <span className="text-xs font-semibold text-gray-300">{col.label}</span>
                  <span className={cn('ml-auto text-xs px-1.5 py-0.5 rounded-full', col.color)}>
                    {(tasksByStatus[col.key] ?? []).length}
                  </span>
                </div>
                <AnimatePresence>
                  {(tasksByStatus[col.key] ?? []).map((task: any, i: number) => {
                    const pCfg = (PRIORITY_CONFIG as any)[task.priority]
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-3 rounded-xl border border-white/8 bg-white/3 hover:border-white/15 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold text-white line-clamp-2 flex-1">{task.title}</p>
                          <span className="text-sm flex-shrink-0">{CATEGORY_ICONS[task.category]}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', pCfg.bg, pCfg.color)}>
                            {pCfg.icon} {task.priority}
                          </span>
                          {task.due_date && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <Clock size={9} />{formatDate(task.due_date, 'MMM d')}
                            </span>
                          )}
                        </div>
                        {task.assignee && (
                          <p className="text-xs text-gray-500 mt-1.5 truncate">👤 {task.assignee.name}</p>
                        )}
                        {/* Move buttons */}
                        <div className="flex gap-1 mt-2 pt-2 border-t border-white/5">
                          {col.key !== 'todo' && (
                            <button
                              className="text-xs text-gray-500 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-white/5"
                              onClick={() => {
                                const prev = COLUMNS[COLUMNS.findIndex(c => c.key === col.key) - 1]
                                if (prev) moveMutation.mutate({ id: task.id, status: prev.key })
                              }}
                            >← Back</button>
                          )}
                          {col.key !== 'done' && (
                            <button
                              className="text-xs text-gray-500 hover:text-gold-400 transition-colors px-1.5 py-0.5 rounded bg-white/5 ml-auto"
                              onClick={() => {
                                const next = COLUMNS[COLUMNS.findIndex(c => c.key === col.key) + 1]
                                if (next) moveMutation.mutate({ id: task.id, status: next.key })
                              }}
                            >Next →</button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {(tasksByStatus[col.key] ?? []).length === 0 && (
                  <div className="py-6 border border-dashed border-white/8 rounded-xl text-center">
                    <p className="text-xs text-gray-600">Empty</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="md">
        <div className="space-y-4">
          <Input label="Title *" placeholder="e.g. Clean basins after closing" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
            <textarea placeholder="Task details..." value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:border-gold-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
            />
            <Select label="Category" value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))}
              options={[{ value: 'cleaning', label: '🧹 Cleaning' }, { value: 'maintenance', label: '🔧 Maintenance' }, { value: 'admin', label: '📋 Admin' }, { value: 'training', label: '🎓 Training' }, { value: 'other', label: '📌 Other' }]}
            />
          </div>
          <Input label="Due Date" type="date" value={form.due_date}
            onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" loading={createMutation.isPending}
              disabled={!form.title} onClick={() => createMutation.mutate()}>Create Task</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
