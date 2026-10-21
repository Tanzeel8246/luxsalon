'use client'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { analyticsService } from '@/services/analyticsService'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

interface CustomTooltipProps {
  active?:  boolean
  payload?: Array<{ value: number }>
  label?:   string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-obsidian-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gold-400">{formatCurrency(payload[0].value)}</p>
      {payload[1] && (
        <p className="text-xs text-gray-400">{payload[1].value} appointments</p>
      )}
    </div>
  )
}

export function RevenueChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-chart', days],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getRevenueChart(days)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const formatted = (data ?? []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }))

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gold-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(formatted.length / 6)}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#D4AF37"
            strokeWidth={2}
            fill="url(#gold-gradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#D4AF37', stroke: '#0A0A0A', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
