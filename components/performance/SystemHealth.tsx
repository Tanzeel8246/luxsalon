'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, Database, HardDrive, Wifi, Server, Zap } from 'lucide-react'
import { performanceService } from '@/services/performanceService'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
// import type { SystemHealth as SystemHealthType } from '@/types'

type HealthStatus = 'healthy' | 'degraded' | 'down'

const STATUS_CONFIG: Record<HealthStatus, { color: string; bg: string; dot: string; label: string }> = {
  healthy:  { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  dot: 'bg-green-400',   label: 'Healthy' },
  degraded: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400 animate-pulse', label: 'Degraded' },
  down:     { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       dot: 'bg-red-400 animate-pulse',    label: 'Down' },
}

function HealthCard({ label, icon, status, metric, unit, detail }: {
  label:   string
  icon:    React.ReactNode
  status:  HealthStatus
  metric:  string | number
  unit?:   string
  detail?: string
}) {
  const cfg = STATUS_CONFIG[status]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('p-4 rounded-xl border', cfg.bg)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('text-current', cfg.color)}>{icon}</div>
          <span className="text-xs font-medium text-gray-300">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
          <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
        </div>
      </div>
      <p className="text-xl font-bold text-white">
        {metric}{unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </p>
      {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
    </motion.div>
  )
}

export function SystemHealthPanel() {
  const { data: health, isLoading } = useQuery({
    queryKey:        ['system-health'],
    queryFn:         () => performanceService.getSystemHealth(),
    refetchInterval: 30000,
  })

  const { data: errorStats } = useQuery({
    queryKey: ['error-stats'],
    queryFn:  async () => {
      const { data } = await performanceService.getErrorStats()
      return data
    },
    refetchInterval: 60000,
  })

  const { data: slowEndpoints = [] } = useQuery({
    queryKey: ['slow-endpoints'],
    queryFn:  async () => {
      const { data } = await performanceService.getTopSlowEndpoints()
      return data ?? []
    },
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader><h3 className="font-semibold text-white">System Health</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Activity size={18} className="text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">System Health</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Uptime: {health?.uptime_pct}% · Last checked: just now
              </p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold',
            health?.api.status === 'healthy' ? 'bg-green-500/10 border-green-500/25 text-green-400' :
            health?.api.status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400' :
            'bg-red-500/10 border-red-500/25 text-red-400'
          )}>
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            All Systems {health?.api.status === 'healthy' ? 'Operational' : health?.api.status === 'degraded' ? 'Degraded' : 'Down'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <HealthCard
            label="Database" icon={<Database size={16} />}
            status={health?.database.status ?? 'healthy'}
            metric={health?.database.latency_ms ?? 0} unit="ms"
            detail={`${health?.database.connections} active connections`}
          />
          <HealthCard
            label="Storage" icon={<HardDrive size={16} />}
            status={health?.storage.status ?? 'healthy'}
            metric={`${health?.storage.used_gb}/${health?.storage.total_gb}`} unit="GB"
            detail={`${Math.round(((health?.storage.used_gb ?? 0) / (health?.storage.total_gb ?? 1)) * 100)}% used`}
          />
          <HealthCard
            label="Realtime" icon={<Wifi size={16} />}
            status={health?.realtime.status ?? 'healthy'}
            metric={health?.realtime.connected_clients ?? 0} unit="clients"
            detail="Supabase Realtime"
          />
          <HealthCard
            label="API" icon={<Server size={16} />}
            status={health?.api.status ?? 'healthy'}
            metric={health?.api.avg_latency_ms ?? 0} unit="ms avg"
            detail={`${health?.api.error_rate}% error rate`}
          />
          <HealthCard
            label="Cache" icon={<Zap size={16} />}
            status={health?.cache.status ?? 'healthy'}
            metric={`${health?.cache.hit_rate}%`} unit="hit rate"
            detail={`${health?.cache.memory_mb}MB used`}
          />
          <div className="p-4 rounded-xl bg-white/3 border border-white/8">
            <p className="text-xs font-medium text-gray-300 mb-3">Error Summary (24h)</p>
            {errorStats && (
              <div className="space-y-1.5">
                {[
                  { level: 'fatal', color: 'bg-red-600' },
                  { level: 'error', color: 'bg-red-400' },
                  { level: 'warn',  color: 'bg-yellow-400' },
                ].map(e => (
                  <div key={e.level} className="flex items-center gap-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full', e.color)} />
                    <span className="text-xs text-gray-400 capitalize w-10">{e.level}</span>
                    <span className="text-xs font-bold text-white">
                      {errorStats.last_24h[e.level as keyof typeof errorStats.last_24h] ?? 0}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-red-400 mt-2">{errorStats.total_unresolved} unresolved</p>
              </div>
            )}
          </div>
        </div>

        {slowEndpoints.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">Slowest Endpoints (24h)</p>
            <div className="space-y-1.5">
              {slowEndpoints.slice(0, 5).map(ep => (
                <div key={ep.endpoint} className="flex items-center gap-3">
                  <code className="text-xs text-gray-400 flex-1 truncate">{ep.endpoint}</code>
                  <div className="w-20 h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', ep.avg_ms > 500 ? 'bg-red-500' : ep.avg_ms > 200 ? 'bg-yellow-500' : 'bg-green-500')}
                      style={{ width: `${Math.min(100, (ep.avg_ms / 1000) * 100)}%` }}
                    />
                  </div>
                  <span className={cn('text-xs font-bold w-14 text-right', ep.avg_ms > 500 ? 'text-red-400' : ep.avg_ms > 200 ? 'text-yellow-400' : 'text-green-400')}>
                    {ep.avg_ms}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
