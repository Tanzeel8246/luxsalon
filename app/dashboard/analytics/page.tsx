'use client'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Header } from '@/components/layout/Header'
import { CustomerLTV } from '@/components/analytics/CustomerLTV'
import { DemandForecast } from '@/components/ai/DemandForecast'
import { ChurnAlert } from '@/components/ai/ChurnAlert'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { biService } from '@/services/biService'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AnalyticsPage() {
  const { data: serviceProfitability = [], isLoading: loadingSvc } = useQuery({
    queryKey: ['service-profitability'],
    queryFn:  async () => {
      const { data, error } = await biService.getServiceProfitability()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: monthlyRevenue = [], isLoading: loadingMonthly } = useQuery({
    queryKey: ['monthly-revenue'],
    queryFn:  async () => {
      const { data, error } = await biService.getMonthlyRevenueTrend(12)
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: kpis = [] } = useQuery({
    queryKey: ['kpi-targets'],
    queryFn:  async () => {
      const { data, error } = await biService.getKPIVsTarget()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  return (
    <>
      <Header title="Advanced Analytics" subtitle="Business Intelligence · AI Insights" />
      <div className="p-6 space-y-6">

        {/* KPI Status */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map(kpi => (
              <div key={kpi.metric} className={`p-4 rounded-xl border ${kpi.status === 'above' ? 'border-green-500/25 bg-green-500/5' : kpi.status === 'on_track' ? 'border-blue-500/25 bg-blue-500/5' : 'border-red-500/25 bg-red-500/5'}`}>
                <p className="text-xs text-gray-500 capitalize">{kpi.metric.replace('_', ' ')}</p>
                <p className="text-xl font-bold text-white mt-1">
                  {kpi.metric.includes('revenue') ? formatCurrency(kpi.actual) : kpi.actual}
                </p>
                <p className={`text-xs mt-1 ${kpi.status === 'above' ? 'text-green-400' : kpi.status === 'on_track' ? 'text-blue-400' : 'text-red-400'}`}>
                  {kpi.pct}% of target
                </p>
                <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${kpi.status === 'above' ? 'bg-green-500' : kpi.status === 'on_track' ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, kpi.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Monthly Revenue Trend */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-white">Monthly Revenue Trend</h3>
            <p className="text-xs text-gray-500 mt-0.5">12-month overview with growth %</p>
          </CardHeader>
          <CardContent>
            {loadingMonthly ? <Skeleton className="h-48 rounded-xl" /> : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={40} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                      formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {monthlyRevenue.map((entry, i) => (
                        <Cell key={i} fill={entry.growth >= 0 ? 'rgba(212,175,55,0.7)' : 'rgba(239,68,68,0.5)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          <DemandForecast />
          <ChurnAlert />
        </div>

        {/* Customer LTV */}
        <CustomerLTV />

        {/* Service Profitability */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-white">Service Profitability</h3>
            <p className="text-xs text-gray-500 mt-0.5">Revenue per minute · Most profitable services</p>
          </CardHeader>
          <CardContent>
            {loadingSvc ? <Skeleton className="h-10 rounded w-full" /> : (
              <div className="space-y-2">
                {serviceProfitability.slice(0, 8).map((s, i) => {
                  const maxRevenue = serviceProfitability[0]?.total_revenue ?? 1
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-white truncate">{s.name}</p>
                          <span className="text-xs text-gray-400 shrink-0 ml-2">{s.total_bookings} bookings</span>
                        </div>
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gold-gradient"
                            style={{ width: `${(s.total_revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 w-28">
                        <p className="text-sm font-bold text-gold-400">{formatCurrency(s.total_revenue)}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(s.revenue_per_minute)}/min</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
