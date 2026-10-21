'use client'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { analyticsService } from '@/services/analyticsService'
import { Skeleton } from '@/components/ui/Skeleton'

interface TooltipProps {
  active?:  boolean
  payload?: Array<{ value: number; payload: { is_peak: boolean } }>
  label?:   string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-obsidian-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{label}:00</p>
      <p className="text-sm font-bold text-white">{payload[0].value} appointments</p>
      {payload[0].payload.is_peak && <p className="text-xs text-gold-400">Peak hour</p>}
    </div>
  )
}

export function PeakHourChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['peak-hours'],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getPeakHours(30)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 15,
  })

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />

  const formatted = Array.from({ length: 24 }, (_, i) => {
    const found = (data ?? []).find(d => d.hour === i)
    return {
      hour:    i,
      label:   `${i}`,
      count:   found?.appointment_count ?? 0,
      is_peak: (i >= 10 && i <= 12) || (i >= 17 && i <= 19),
    }
  }).filter(d => d.count > 0)

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}h`}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.is_peak ? '#D4AF37' : 'rgba(212,175,55,0.3)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
