'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, AlertTriangle, Info, XCircle, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { securityService } from '@/services/securityService'
import { formatDateTime, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { SkeletonTable } from '@/components/ui/Skeleton'
// import type { AuditLog } from '@/types'

const severityConfig = {
  info:     { icon: <Info size={14} />,          class: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  warning:  { icon: <AlertTriangle size={14} />,  class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25' },
  critical: { icon: <XCircle size={14} />,        class: 'bg-red-500/10 text-red-400 border-red-500/25' },
}

const actionColors: Record<string, string> = {
  INSERT: 'text-green-400',
  UPDATE: 'text-blue-400',
  DELETE: 'text-red-400',
}

export function AuditLogPanel() {
  const [severity,   setSeverity]   = useState<string>('')
  const [resource,   setResource]   = useState<string>('')
  const [detailLog,  setDetailLog]  = useState<any | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', severity, resource],
    queryFn:  async () => {
      const { data, error } = await securityService.getAuditLogs({
        severity:  severity   as any || undefined,
        resource:  resource   || undefined,
        limit:     200,
      })
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 30000,
  })

  const criticalCount = logs.filter(l => l.severity === 'critical').length
  const warningCount  = logs.filter(l => l.severity === 'warning').length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Shield size={18} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Audit Logs</h3>
                <p className="text-xs text-gray-500">Complete action history · {logs.length} records</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-bold">{criticalCount} Critical</span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-bold">{warningCount} Warning</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <Select
              value={severity}
              onChange={e => setSeverity(e.target.value)}
              options={[
                { value: '',         label: 'All Severities' },
                { value: 'info',     label: 'Info' },
                { value: 'warning',  label: 'Warning' },
                { value: 'critical', label: 'Critical' },
              ]}
              className="w-36"
            />
            <Select
              value={resource}
              onChange={e => setResource(e.target.value)}
              options={[
                { value: '',               label: 'All Resources' },
                { value: 'appointments',   label: 'Appointments' },
                { value: 'customers',      label: 'Customers' },
                { value: 'staff',          label: 'Staff' },
                { value: 'inventory',      label: 'Inventory' },
                { value: 'pricing_rules',  label: 'Pricing Rules' },
                { value: 'staff_payroll',  label: 'Payroll' },
              ]}
              className="w-36"
            />
          </div>

          {/* Log table */}
          {isLoading ? <SkeletonTable rows={6} /> : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {logs.map((log: any, i: number) => {
                const cfg = severityConfig[log.severity as keyof typeof severityConfig] || severityConfig.info
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/2 border border-white/6 hover:border-white/10 transition-colors"
                  >
                    <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs border shrink-0', cfg.class)}>
                      {cfg.icon}
                      {log.severity}
                    </div>
                    <span className={cn('text-xs font-bold w-14 shrink-0', actionColors[log.action] ?? 'text-gray-400')}>
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400 w-24 shrink-0 truncate">{log.resource}</span>
                    <span className="flex-1 text-xs text-gray-500 truncate">{log.resource_id}</span>
                    <span className="text-xs text-gray-600 shrink-0">{formatDateTime(log.created_at)}</span>
                    <button
                      onClick={() => setDetailLog(log)}
                      className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors shrink-0"
                    >
                      <Eye size={13} />
                    </button>
                  </motion.div>
                )
              })}
              {logs.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No audit logs found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Modal open={!!detailLog} onClose={() => setDetailLog(null)} title="Audit Log Detail" size="lg">
        {detailLog && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Action',    value: detailLog.action },
                { label: 'Resource',  value: detailLog.resource },
                { label: 'Severity',  value: detailLog.severity },
                { label: 'IP',        value: detailLog.ip_address ?? 'N/A' },
                { label: 'Time',      value: formatDateTime(detailLog.created_at) },
                { label: 'User',      value: detailLog.user_id ?? 'System' },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-lg bg-white/3 border border-white/8">
                  <p className="text-xs text-gray-500">{f.label}</p>
                  <p className="text-sm text-white font-medium mt-0.5 truncate">{f.value}</p>
                </div>
              ))}
            </div>
            {detailLog.old_data && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Old Data</p>
                <pre className="text-xs text-gray-300 bg-white/3 border border-white/8 rounded-lg p-3 overflow-auto max-h-32">
                  {JSON.stringify(detailLog.old_data, null, 2)}
                </pre>
              </div>
            )}
            {detailLog.new_data && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">New Data</p>
                <pre className="text-xs text-gray-300 bg-white/3 border border-white/8 rounded-lg p-3 overflow-auto max-h-32">
                  {JSON.stringify(detailLog.new_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
