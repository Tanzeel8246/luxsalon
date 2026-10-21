'use client'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { staffService } from '@/services/staffService'
import { formatCurrency } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeleton'

export function StaffPerformance() {
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff-performance'],
    queryFn:  async () => {
      const { data, error } = await staffService.getPerformance()
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 60000,
  })

  if (isLoading) return <SkeletonTable rows={4} />

  return (
    <div className="space-y-3">
      {staff.slice(0, 6).map((item, i) => (
        <div key={item.staff.id} className="flex items-center gap-4">
          <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>
          <div className="w-9 h-9 rounded-full bg-gold-500/15 border border-gold-500/20 flex items-center justify-center shrink-0">
            <span className="text-gold-400 text-sm font-semibold">
              {item.staff.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.staff.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={10} className="text-gold-500 fill-gold-500" />
              <span className="text-xs text-gray-400">{item.avg_rating.toFixed(1)}</span>
              <span className="text-xs text-gray-600 ml-2">{item.appointments_today} appts</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-white">{formatCurrency(item.revenue_today)}</p>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <div className="h-1 w-16 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gold-500"
                  style={{ width: `${item.completion_rate}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{item.completion_rate}%</span>
            </div>
          </div>
        </div>
      ))}
      {staff.length === 0 && (
        <p className="text-center text-gray-500 py-6 text-sm">No performance data for today.</p>
      )}
    </div>
  )
}
