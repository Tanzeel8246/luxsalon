'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Users, DollarSign, Star, TrendingUp } from 'lucide-react'
import { branchService } from '@/services/branchService'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

export function BranchDashboard() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['branch-stats'],
    queryFn:  async () => {
      const { data, error } = await branchService.getAllBranchStats()
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 60000,
  })

  const totalRevenue   = stats.reduce((s, b) => s + b.today_revenue, 0)
  const totalAppts     = stats.reduce((s, b) => s + b.appointments, 0)
  const totalStaff     = stats.reduce((s, b) => s + b.active_staff, 0)
  const bestBranch     = [...stats].sort((a, b) => b.today_revenue - a.today_revenue)[0]

  return (
    <div className="space-y-6">
      {/* Network summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Network Revenue',  value: formatCurrency(totalRevenue), icon: <DollarSign size={16} />, color: 'text-gold-400' },
          { label: 'Total Branches',   value: stats.length,                  icon: <MapPin size={16} />,    color: 'text-blue-400' },
          { label: 'Total Appts',      value: totalAppts,                    icon: <TrendingUp size={16} />,color: 'text-green-400' },
          { label: 'Active Staff',     value: totalStaff,                    icon: <Users size={16} />,     color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className={cn('p-4 rounded-xl border border-white/8 bg-obsidian-950/60')}>
            <div className={cn('mb-2', s.color)}>{s.icon}</div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Branch cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((item, i) => (
            <motion.div
              key={item.branch.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn(
                'rounded-xl border p-5 space-y-4 transition-all',
                item.branch.id === bestBranch?.branch.id
                  ? 'border-gold-500/40 bg-gold-500/5 shadow-gold'
                  : 'border-white/8 bg-obsidian-950/60 hover:border-white/15'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{item.branch.name}</h3>
                    {item.branch.is_franchise && (
                      <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">Franchise</Badge>
                    )}
                    {item.branch.id === bestBranch?.branch.id && (
                      <Badge className="bg-gold-500/15 text-gold-400 border border-gold-500/30 text-xs">Top</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />{item.branch.city ?? 'N/A'}
                  </p>
                </div>
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full mt-1',
                  item.branch.is_active ? 'bg-green-400' : 'bg-red-400'
                )} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-sm font-bold text-gold-400">{formatCurrency(item.today_revenue)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-xs text-gray-500">Appointments</p>
                  <p className="text-sm font-bold text-white">{item.appointments}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-xs text-gray-500">Active Staff</p>
                  <p className="text-sm font-bold text-white">{item.active_staff}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-xs text-gray-500">Avg Rating</p>
                  <p className="text-sm font-bold text-white flex items-center gap-1">
                    <Star size={11} className="text-gold-500 fill-gold-500" />
                    {item.avg_rating || '—'}
                  </p>
                </div>
              </div>

              {item.branch.is_franchise && (
                <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15 text-xs text-purple-400">
                  Royalty: {(item.branch.royalty_rate * 100).toFixed(1)}% = {formatCurrency(item.today_revenue * item.branch.royalty_rate)}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
