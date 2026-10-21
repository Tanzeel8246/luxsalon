import { getSupabaseClient } from '@/lib/supabase'
import { subDays, parseISO } from 'date-fns'
import type { RecommendationResult, ApiResponse } from '@/types'

export const recommendationService = {
  async getRecommendations(
    customerId: string,
    limit = 5
  ): Promise<ApiResponse<RecommendationResult[]>> {
    const supabase = getSupabaseClient()

    const [{ data: history }, { data: allServices }, { data: trends }] = await Promise.all([
      supabase
        .from('appointments')
        .select('service_id, start_time, service(*)')
        .eq('customer_id', customerId)
        .in('status', ['completed'])
        .order('start_time', { ascending: false })
        .limit(50),

      supabase
        .from('services')
        .select('*')
        .eq('is_active', true),

      supabase
        .from('appointments')
        .select('service_id')
        .gte('start_time', subDays(new Date(), 30).toISOString())
        .in('status', ['completed', 'confirmed']),
    ])

    if (!allServices) return { data: [], error: null }

    const frequencyMap: Record<string, number>  = {}
    const lastVisitMap: Record<string, string>  = {}
    const trendMap:     Record<string, number>  = {}

    history?.forEach(appt => {
      const sid = appt.service_id
      frequencyMap[sid] = (frequencyMap[sid] ?? 0) + 1
      if (!lastVisitMap[sid] || appt.start_time > lastVisitMap[sid]) {
        lastVisitMap[sid] = appt.start_time
      }
    })

    trends?.forEach(appt => {
      trendMap[appt.service_id] = (trendMap[appt.service_id] ?? 0) + 1
    })

    const maxFreq  = Math.max(1, ...Object.values(frequencyMap))
    const maxTrend = Math.max(1, ...Object.values(trendMap))

    const scored: RecommendationResult[] = allServices.map(service => {
      const freq     = frequencyMap[service.id]  ?? 0
      const trendCnt = trendMap[service.id]       ?? 0
      const lastUsed = lastVisitMap[service.id]   ?? null

      const freqScore    = (freq / maxFreq) * 0.4
      const trendScore   = (trendCnt / maxTrend) * 0.35
      const noveltyScore = freq === 0 ? 0.25 : 0

      const daysSinceLast = lastUsed
        ? (Date.now() - parseISO(lastUsed).getTime()) / (1000 * 60 * 60 * 24)
        : 999
      const recencyScore = daysSinceLast > 30 ? 0.1 : 0

      const score = freqScore + trendScore + noveltyScore + recencyScore

      let reason: string
      if (freq > 3)            reason = 'Your go-to service'
      else if (trendCnt > 10)  reason = 'Trending this month'
      else if (freq === 0)     reason = 'You haven\'t tried this yet'
      else if (daysSinceLast > 30) reason = 'Due for a revisit'
      else                     reason = 'Recommended for you'

      return { service, score, reason, last_used: lastUsed }
    })

    const sorted = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return { data: sorted, error: null }
  },

  async getTrendingServices(limit = 6): Promise<ApiResponse<RecommendationResult[]>> {
    const supabase = getSupabaseClient()

    const { data: recent, error } = await supabase
      .from('appointments')
      .select('service_id, service(*)')
      .gte('start_time', subDays(new Date(), 7).toISOString())
      .in('status', ['completed', 'confirmed', 'in_progress'])

    if (error || !recent) return { data: null, error: error?.message ?? 'Trend error' }

    const trendMap: Record<string, { count: number; service: unknown }> = {}
    recent.forEach(appt => {
      const sid = appt.service_id
      if (!trendMap[sid]) trendMap[sid] = { count: 0, service: appt.service }
      trendMap[sid].count++
    })

    const sorted = Object.entries(trendMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([, v]) => ({
        service:  v.service as RecommendationResult['service'],
        score:    v.count,
        reason:   'Trending this week',
        last_used: null,
      }))

    return { data: sorted, error: null }
  },
}
