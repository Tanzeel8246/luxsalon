'use client'
import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Trophy, TrendingUp, UserX, User } from 'lucide-react'
import { biService } from '@/services/biService'
import { formatCurrency, tierBadgeClass } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

const SEGMENT_COLORS: Record<string, string> = {
  champion: '#D4AF37',
  loyal:    '#60a5fa',
  at_risk:  '#fb923c',
  lost:     '#f87171',
  new:      '#4ade80',
}

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  champion: <Trophy size={14} />,
  loyal:    <TrendingUp size={14} />,
  at_risk:  <UserX size={14} />,
  lost:     <UserX size={14} />,
  new:      <User size={14} />,
}

export function CustomerLTV() {
  const { data: topCustomers = [], isLoading: loadingTop } = useQuery({
    queryKey: ['customer-ltv'],
    queryFn:  async () => {
      const { data, error } = await biService.getCustomerLTV(10)
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: segments } = useQuery({
    queryKey: ['ltv-segments'],
    queryFn:  async () => {
      const { data, error } = await biService.getLTVSegments()
      if (error) throw new Error(error)
      return data ?? {}
    },
  })

  const pieData = Object.entries(segments ?? {})
    .filter(([, v]) => v.count > 0)
    .map(([seg, v]) => ({
      name:  seg.charAt(0).toUpperCase() + seg.slice(1).replace('_', ' '),
      value: v.count,
      color: SEGMENT_COLORS[seg],
    }))

  const totalRevenue = Object.values(segments ?? {}).reduce((s, v) => s + v.total_revenue, 0)
  const totalCustomers = Object.values(segments ?? {}).reduce((s, v) => s + v.count, 0)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Segment donut */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white">Customer Segments</h3>
          <p className="text-xs text-gray-500 mt-0.5">{totalCustomers} customers classified by CLV</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                  formatter={(v: number, name: string) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {Object.entries(segments ?? {}).map(([seg, v]) => (
              <div key={seg} className="flex items-center gap-2 p-2 rounded-lg bg-white/3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[seg] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white capitalize">{seg.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500">{v.count} · {formatCurrency(v.avg_ltv)} avg</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top customers */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white">Top Customers by LTV</h3>
          <p className="text-xs text-gray-500 mt-0.5">Total tracked: {formatCurrency(totalRevenue)}</p>
        </CardHeader>
        <CardContent>
          {loadingTop ? (
            <SkeletonTable rows={5} />
          ) : (
            <div className="space-y-3">
              {topCustomers.slice(0, 7).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-300">
                      {c.customer?.name?.charAt(0) ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.customer?.name ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{c.total_visits} visits</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                        style={{ background: SEGMENT_COLORS[c.clv_segment] + '20', color: SEGMENT_COLORS[c.clv_segment] }}
                      >
                        {c.clv_segment?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gold-400">{formatCurrency(c.total_spent)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(c.avg_order_value)} avg</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
