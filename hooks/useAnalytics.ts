'use client'
import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/services/analyticsService'
import { biService } from '@/services/biService'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getDashboardStats()
      if (error) throw new Error(error)
      return data
    },
    refetchInterval: 30000,
  })
}

export function useRevenueChart(days = 30) {
  return useQuery({
    queryKey: ['revenue-chart', days],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getRevenueChart(days)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function usePeakHours(days = 30) {
  return useQuery({
    queryKey: ['peak-hours', days],
    queryFn:  async () => {
      const { data, error } = await analyticsService.getPeakHours(days)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 15,
  })
}

export function useMonthlyTrend(months = 12) {
  return useQuery({
    queryKey: ['monthly-trend', months],
    queryFn:  async () => {
      const { data, error } = await biService.getMonthlyRevenueTrend(months)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useServiceProfitability() {
  return useQuery({
    queryKey: ['service-profitability'],
    queryFn:  async () => {
      const { data, error } = await biService.getServiceProfitability()
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useKPITargets() {
  return useQuery({
    queryKey: ['kpi-targets'],
    queryFn:  async () => {
      const { data, error } = await biService.getKPIVsTarget()
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 60000,
  })
}
