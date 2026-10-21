'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle, XCircle, Clock, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { schedulingService } from '@/services/schedulingService'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import toast from 'react-hot-toast'
// import type { StaffLeave } from '@/types'

const STATUS_CONFIG = {
  pending:  { icon: <Clock size={12} />,         class: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/25' },
  approved: { icon: <CheckCircle size={12} />,   class: 'bg-green-500/12 text-green-400 border-green-500/25' },
  rejected: { icon: <XCircle size={12} />,       class: 'bg-red-500/12 text-red-400 border-red-500/25' },
  cancelled:{ icon: <XCircle size={12} />,       class: 'bg-gray-500/12 text-gray-400 border-gray-500/20' },
}

const LEAVE_COLORS: Record<string, string> = {
  annual: 'text-blue-400', sick: 'text-red-400', emergency: 'text-orange-400',
  unpaid: 'text-gray-400', maternity: 'text-pink-400', paternity: 'text-purple-400',
}

export function LeaveManager({ currentStaffId }: { currentStaffId?: string }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    staff_id:   currentStaffId ?? '',
    leave_type: 'annual' as any,
    start_date: '',
    end_date:   '',
    reason:     '',
  })

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['staff-leaves', currentStaffId],
    queryFn:  async () => {
      const { data, error } = await schedulingService.getLeaves(currentStaffId)
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const requestMutation = useMutation({
    mutationFn: () => schedulingService.requestLeave({
      staff_id:   form.staff_id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date:   form.end_date,
      reason:     form.reason || null,
    }),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['staff-leaves'] })
      setShowModal(false)
      toast.success('Leave request submitted!')
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      schedulingService.approveLeave(id, 'admin', approved),
    onSuccess: (result, vars) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['staff-leaves'] })
      toast.success(vars.approved ? 'Leave approved!' : 'Leave rejected.')
    },
  })

  const pendingCount  = leaves.filter(l => l.status === 'pending').length
  const approvedCount = leaves.filter(l => l.status === 'approved').length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Calendar size={18} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Leave Management</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {pendingCount} pending · {approvedCount} approved
                </p>
              </div>
            </div>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowModal(true)}>
              Request Leave
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {leaves.map((leave: any, i: number) => {
              const cfg  = STATUS_CONFIG[leave.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
              const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86400000) + 1
              return (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/2"
                >
                  <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-gray-300">{leave.staff?.name?.charAt(0) ?? '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{leave.staff?.name ?? '—'}</p>
                      <span className={cn('text-xs capitalize font-medium', LEAVE_COLORS[leave.leave_type])}>
                        {leave.leave_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(leave.start_date)} → {formatDate(leave.end_date)} ({days} days)
                    </p>
                    {leave.reason && <p className="text-xs text-gray-600 mt-0.5 truncate">{leave.reason}</p>}
                  </div>
                  <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full border text-xs shrink-0', cfg.class)}>
                    {cfg.icon}{leave.status}
                  </div>
                  {leave.status === 'pending' && !currentStaffId && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                        onClick={() => approveMutation.mutate({ id: leave.id, approved: true })}>✓</Button>
                      <Button size="sm" variant="danger"
                        onClick={() => approveMutation.mutate({ id: leave.id, approved: false })}>✕</Button>
                    </div>
                  )}
                </motion.div>
              )
            })}
            {leaves.length === 0 && !isLoading && (
              <p className="text-center text-gray-500 py-6 text-sm">No leave requests.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Leave">
        <div className="space-y-4">
          <Select
            label="Leave Type"
            value={form.leave_type}
            onChange={e => setForm(p => ({ ...p, leave_type: e.target.value as any }))}
            options={[
              { value: 'annual',     label: 'Annual Leave' },
              { value: 'sick',       label: 'Sick Leave' },
              { value: 'emergency',  label: 'Emergency Leave' },
              { value: 'unpaid',     label: 'Unpaid Leave' },
              { value: 'maternity',  label: 'Maternity Leave' },
              { value: 'paternity',  label: 'Paternity Leave' },
            ]}
          />
          <Input label="From Date" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          <Input label="To Date"   type="date" value={form.end_date}   onChange={e => setForm(p => ({ ...p, end_date:   e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Reason (optional)</label>
            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3}
              placeholder="Brief reason for leave..."
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={requestMutation.isPending}
              disabled={!form.start_date || !form.end_date}
              onClick={() => requestMutation.mutate()}>Submit Request</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
