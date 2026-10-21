'use client'
import { useQuery } from '@tanstack/react-query'
import { recommendationService } from '@/services/recommendationService'

export function useRecommendations(customerId: string, limit = 5) {
  return useQuery({
    queryKey: ['recommendations', customerId],
    queryFn:  async () => {
      const { data, error } = await recommendationService.getRecommendations(customerId, limit)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled:   !!customerId,
    staleTime: 1000 * 60 * 15,
  })
}

export function useTrendingServices(limit = 6) {
  return useQuery({
    queryKey: ['trending-services'],
    queryFn:  async () => {
      const { data, error } = await recommendationService.getTrendingServices(limit)
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })
}
