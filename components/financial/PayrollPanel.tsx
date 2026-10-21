'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { payrollService } from '@/services/payrollService'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

const statusConfig = {
  pending:  { class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <Clock size={11} /> },
  approved: { class: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: <CheckCircle size={11} /> },
  paid:     { class: 'bg-green-500/15 text-green-400 border-green-500/30',    icon: <CheckCircle size={11} /> },
}

export function PayrollPanel() {
  const qc = useQueryClient()

  const { data = { payrolls: [] as any[], total: 0 }, isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn:  async () => {
      const { data, error } = await payrollService.getPayrollHistory()
      if (error) throw new Error(error)
      return data ?? { payrolls: [], total: 0 }
    },
  })
  const payroll = (data as any).payrolls || []

  const approveMutation = useMutation({
    mutationFn: (id: string) => payrollService.approvePayroll(id, 'Admin'),
    onSuccess:  (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['payroll'] })
      toast.success('Payroll approved!')
    },
  })

  const payMutation = useMutation({
    mutationFn: (id: string) => payrollService.markPaid(id),
    onSuccess:  (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['payroll'] })
      toast.success('Payment marked as paid!')
    },
  })

  const processMonthly = useMutation({
    mutationFn: () => {
      const now = new Date()
      return payrollService.processMonthlyPayroll(now.getFullYear(), now.getMonth() + 1)
    },
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['payroll'] })
      toast.success(`Payroll processed for ${result.data?.length} staff members!`)
    },
  })

  const totalGross  = payroll.reduce((s: number, p: any) => s + p.gross_total, 0)
  const totalNet    = payroll.reduce((s: number, p: any) => s + p.net_pay, 0)
  const totalComm   = payroll.reduce((s: number, p: any) => s + p.commission_earned, 0)
  const pendingCount = payroll.filter((p: any) => p.status === 'pending').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Payroll Management</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {pendingCount > 0 ? `${pendingCount} pending approval` : 'All up to date'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            loading={processMonthly.isPending}
            icon={<DollarSign size={13} />}
            onClick={() => processMonthly.mutate()}
          >
            Process Month
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Gross Total',   value: formatCurrency(totalGross),  color: 'text-white' },
            { label: 'Net Payable',   value: formatCurrency(totalNet),    color: 'text-gold-400' },
            { label: 'Commissions',   value: formatCurrency(totalComm),   color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Payroll list */}
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : payroll.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">No payroll records yet. Process the current month.</p>
        ) : (
          <div className="space-y-3">
            {payroll.slice(0, 10).map((p: any, i: number) => {
              const cfg = (statusConfig as any)[p.status] || statusConfig.pending
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/2"
                >
                  <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                    <span className="text-gold-400 text-sm font-bold">
                      {p.staff?.name?.charAt(0) ?? '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.staff?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.period_start} → {p.period_end}
                    </p>
                  </div>

                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-500">Salary + Comm + Tips</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(p.base_salary)} + {formatCurrency(p.commission_earned)} + {formatCurrency(p.tips_earned)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gold-400">{formatCurrency(p.net_pay)}</p>
                    <p className="text-xs text-gray-500">net pay</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs border', cfg.class)}>
                      {cfg.icon}
                      {p.status}
                    </span>
                    {p.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(p.id)} loading={approveMutation.isPending}>
                        Approve
                      </Button>
                    )}
                    {p.status === 'approved' && (
                      <Button size="sm" onClick={() => payMutation.mutate(p.id)} loading={payMutation.isPending}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
