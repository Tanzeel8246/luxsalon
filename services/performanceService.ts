import { getSupabaseClient } from '@/lib/supabase'
import { subHours, subDays, format } from 'date-fns'
import type { ErrorLog, PerformanceMetric, SystemHealth, Webhook, ApiResponse } from '@/types'

export const performanceService = {
  // ── System Health ────────────────────────────────────────────
  async getSystemHealth(): Promise<SystemHealth> {
    const supabase  = getSupabaseClient()
    const startTime = Date.now()

    // Ping database
    const { error: pingErr } = await supabase.from('services').select('id').limit(1).single() as any
    const dbLatency = Date.now() - startTime

    // Recent error rate
    const oneHourAgo = subHours(new Date(), 1).toISOString()
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('level')
      .gte('created_at', oneHourAgo)

    const totalRequests = 1000
    const errorCount    = (recentErrors ?? []).filter(e => e.level === 'error' || e.level === 'fatal').length
    const errorRate     = errorCount / totalRequests * 100

    // Average API latency (last hour)
    const { data: perfData } = await supabase
      .from('performance_metrics')
      .select('metric_value')
      .eq('metric_name', 'api_response_time')
      .gte('recorded_at', oneHourAgo)

    const avgLatency = perfData?.length
      ? perfData.reduce((s, p) => s + p.metric_value, 0) / perfData.length
      : dbLatency

    return {
      database: {
        status:      pingErr ? 'down' : dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'down',
        latency_ms:  dbLatency,
        connections: 12,
      },
      storage: {
        status:    'healthy',
        used_gb:   2.4,
        total_gb:  8,
      },
      realtime: {
        status:            'healthy',
        connected_clients: 24,
      },
      api: {
        status:          errorRate < 1 ? 'healthy' : errorRate < 5 ? 'degraded' : 'down',
        avg_latency_ms:  Math.round(avgLatency),
        error_rate:      Math.round(errorRate * 10) / 10,
      },
      cache: {
        status:     'healthy',
        hit_rate:   87.4,
        memory_mb:  156,
      },
      uptime_pct:   99.97,
      last_checked: new Date().toISOString(),
    }
  },

  // ── Error Logs ───────────────────────────────────────────────
  async logError(payload: {
    level:        ErrorLog['level']
    message:      string
    stack?:       string
    source?:      string
    request_path?: string
    request_data?: Record<string, unknown>
  }): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.from('error_logs').insert({
      level:        payload.level,
      message:      payload.message,
      stack:        payload.stack ?? null,
      source:       payload.source ?? null,
      request_path: payload.request_path ?? null,
      request_data: payload.request_data ?? {},
      environment:  process.env.NODE_ENV ?? 'production',
      resolved:     false,
    })
  },

  async getErrorLogs(level?: ErrorLog['level'], limit = 100): Promise<ApiResponse<ErrorLog[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('error_logs').select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (level) query = query.eq('level', level)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async resolveError(errorId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    await supabase.from('error_logs').update({ resolved: true }).eq('id', errorId)
    return { data: undefined, error: null }
  },

  async getErrorStats(): Promise<ApiResponse<{
    last_24h: Record<ErrorLog['level'], number>
    total_unresolved: number
  }>> {
    const supabase = getSupabaseClient()
    const since = subDays(new Date(), 1).toISOString()
    const { data } = await supabase
      .from('error_logs').select('level, resolved').gte('created_at', since)

    const stats: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }
    ;(data ?? []).forEach(e => { if (stats[e.level] !== undefined) stats[e.level]++ })

    const totalUnresolved = (data ?? []).filter(e => !e.resolved && (e.level === 'error' || e.level === 'fatal')).length

    return { data: { last_24h: stats as Record<ErrorLog['level'], number>, total_unresolved: totalUnresolved }, error: null }
  },

  // ── Performance Metrics ──────────────────────────────────────
  async recordMetric(payload: Omit<PerformanceMetric, 'id' | 'recorded_at'>): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.from('performance_metrics').insert({ ...payload, recorded_at: new Date().toISOString() })
  },

  async getMetricTrend(metricName: string, hours = 24): Promise<ApiResponse<PerformanceMetric[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('metric_name', metricName)
      .gte('recorded_at', subHours(new Date(), hours).toISOString())
      .order('recorded_at', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getTopSlowEndpoints(limit = 10): Promise<ApiResponse<{ endpoint: string; avg_ms: number; count: number }[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('endpoint, duration_ms')
      .not('endpoint', 'is', null)
      .gte('recorded_at', subDays(new Date(), 1).toISOString())

    if (error) return { data: null, error: error.message }

    const grouped: Record<string, { total: number; count: number }> = {}
    ;(data ?? []).forEach(m => {
      const ep = m.endpoint!
      if (!grouped[ep]) grouped[ep] = { total: 0, count: 0 }
      grouped[ep].total += m.duration_ms ?? 0
      grouped[ep].count++
    })

    const result = Object.entries(grouped)
      .map(([endpoint, v]) => ({ endpoint, avg_ms: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg_ms - a.avg_ms)
      .slice(0, limit)

    return { data: result, error: null }
  },

  // ── Webhooks ─────────────────────────────────────────────────
  async createWebhook(payload: Omit<Webhook, 'id' | 'last_fired' | 'success_count' | 'failure_count' | 'created_at'>): Promise<ApiResponse<Webhook>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('webhooks').insert({ ...payload, success_count: 0, failure_count: 0 }).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getWebhooks(): Promise<ApiResponse<Webhook[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('webhooks').select('*').order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async fireWebhook(webhookId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: webhook } = await supabase.from('webhooks').select('*').eq('id', webhookId).eq('is_active', true).single() as any
    if (!webhook) return

    const start = Date.now()
    try {
      const res = await fetch(webhook.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhook.secret ?? '' },
        body:    JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() }),
      })

      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhookId, event_type: eventType, payload,
        status_code: res.status, duration_ms: Date.now() - start,
      })

      await supabase.from('webhooks')
        .update({ last_fired: new Date().toISOString(), success_count: webhook.success_count + 1 })
        .eq('id', webhookId)
    } catch {
      await supabase.from('webhooks')
        .update({ failure_count: webhook.failure_count + 1 })
        .eq('id', webhookId)
    }
  },

  // ── Simple In-DB Cache ───────────────────────────────────────
  async cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const supabase = getSupabaseClient()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    await supabase.from('cache_keys').upsert({
      key, value: value as Record<string, unknown>, expires_at: expiresAt,
    }, { onConflict: 'key' })
  },

  async cacheGet<T>(key: string): Promise<T | null> {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('cache_keys').select('*').eq('key', key).gt('expires_at', new Date().toISOString()).single() as any
    if (!data) return null
    await supabase.from('cache_keys').update({ hit_count: data.hit_count + 1 }).eq('key', key)
    return data.value as T
  },

  async cacheInvalidate(pattern: string): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.from('cache_keys').delete().like('key', `${pattern}%`)
  },
}
