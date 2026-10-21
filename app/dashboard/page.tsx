'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  DollarSign, CalendarDays, Users, ListOrdered, Star
} from 'lucide-react'
import { analyticsService } from '@/services/analyticsService'
import { Header } from '@/components/layout/Header'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { PeakHourChart } from '@/components/dashboard/PeakHourChart'
import { StaffPerformance } from '@/components/dashboard/StaffPerformance'
import { LowStockAlert } from '@/components/inventory/LowStockAlert'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getDashboardStats()
      if (error) throw new Error(error)
      return data
    },
    refetchInterval: 30000,
  })

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={mounted ? format(new Date(), 'EEEE, MMMM d, yyyy') : ''}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Today's Revenue"
            value={formatCurrency(stats?.total_revenue ?? 0)}
            change={stats?.revenue_growth}
            icon={<DollarSign size={18} />}
            subtitle="vs. yesterday"
            delay={0}
          />
          <StatsCard
            title="Appointments"
            value={stats?.today_appointments ?? 0}
            icon={<CalendarDays size={18} />}
            subtitle="today"
            delay={0.1}
          />
          <StatsCard
            title="Active Staff"
            value={stats?.active_staff ?? 0}
            icon={<Users size={18} />}
            subtitle="on duty"
            delay={0.2}
          />
          <StatsCard
            title="Queue"
            value={stats?.queue_count ?? 0}
            icon={<ListOrdered size={18} />}
            subtitle="waiting"
            delay={0.3}
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            title="Avg Rating"
            value={stats?.avg_rating ? `${stats.avg_rating}★` : '—'}
            icon={<Star size={18} />}
            subtitle="today"
            delay={0.35}
          />
        </div>

        {/* Low stock alerts */}
        <LowStockAlert />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Revenue — Last 30 Days</h2>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueChart days={30} />
            </CardContent>
          </Card>

          {/* Staff performance */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-white">Staff Performance</h2>
              <p className="text-xs text-gray-500 mt-0.5">Today</p>
            </CardHeader>
            <CardContent>
              <StaffPerformance />
            </CardContent>
          </Card>
        </div>

        {/* Peak hours */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white">Peak Hours Detection</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 30 days · Gold bars = peak hours</p>
          </CardHeader>
          <CardContent>
            <PeakHourChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
