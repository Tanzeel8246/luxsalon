'use client'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'
import { TrendingUp, Users, DollarSign, Brain } from 'lucide-react'
import { aiService } from '@/services/aiService'
import { formatCurrency } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export function DemandForecast() {
  const { data: forecasts = [], isLoading } = useQuery({
    queryKey: ['demand-forecast'],
    queryFn:  async () => {
      const { data, error } = await aiService.getForecasts(7)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 60,
  })

  const formatted = forecasts.map(f => ({
    ...f,
    label:    format(parseISO(f.forecast_date), 'EEE dd'),
    isWeekend: [0, 6].includes(f.day_of_week),
  }))

  const totalPredicted = forecasts.reduce((s, f) => s + f.predicted_customers, 0)
  const totalRevenue   = forecasts.reduce((s, f) => s + f.predicted_revenue, 0)
  const avgConfidence  = forecasts.length
    ? forecasts.reduce((s, f) => s + f.confidence_score, 0) / forecasts.length
    : 0
  const peakDay = [...forecasts].sort((a, b) => b.predicted_customers - a.predicted_customers)[0]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/20">
            <Brain size={18} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">AI Demand Forecast</h3>
            <p className="text-xs text-gray-500">Next 7 days prediction · Confidence: {(avgConfidence * 100).toFixed(0)}%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
            <Users size={16} className="text-purple-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{totalPredicted}</p>
            <p className="text-xs text-gray-500">Predicted Customers</p>
          </div>
          <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
            <DollarSign size={16} className="text-gold-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-500">Predicted Revenue</p>
          </div>
          <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{peakDay ? format(parseISO(peakDay.forecast_date), 'EEE') : '—'}</p>
            <p className="text-xs text-gray-500">Busiest Day</p>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#a855f7' }}
                  formatter={(v: number) => [v, 'Predicted Customers']}
                />
                <Area
                  type="monotone"
                  dataKey="predicted_customers"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#purpleGrad)"
                  dot={{ r: 3, fill: '#a855f7', stroke: '#0A0A0A', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Day list */}
        <div className="space-y-2">
          {formatted.map(f => (
            <div key={f.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-12 shrink-0">{f.label}</span>
              <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      `${Math.min(100, (f.predicted_customers / (peakDay?.predicted_customers || 1)) * 100)}%`,
                    background: f.isWeekend ? 'rgba(212,175,55,0.7)' : 'rgba(168,85,247,0.6)',
                  }}
                />
              </div>
              <span className="text-xs font-medium text-white w-8 text-right">{f.predicted_customers}</span>
              <span className="text-xs text-gray-500 w-16 text-right">{formatCurrency(f.predicted_revenue)}</span>
              <span className="text-xs text-gray-600 w-10 text-right">
                {(f.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
