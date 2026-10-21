import { getSupabaseClient } from '@/lib/supabase'
import type { QueueEntry, QueueStats, ApiResponse } from '@/types'

export const queueService = {
  async getActiveQueue(): Promise<ApiResponse<QueueEntry[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('queue')
      .select('*, customer(*), service(*), staff(*)')
      .in('status', ['waiting', 'called', 'serving'])
      .order('position', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async addToQueue(payload: {
    customer_id: string
    service_id:  string
    staff_id?:   string
  }): Promise<ApiResponse<QueueEntry>> {
    const supabase = getSupabaseClient()

    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'called', 'serving'])

    const position = (count ?? 0) + 1

    const stats = await this.getQueueStats()
    const estimatedWait = stats.data ? Math.ceil(stats.data.estimated_wait) : 0

    const { data, error } = await supabase
      .from('queue')
      .insert({
        ...payload,
        staff_id:       payload.staff_id ?? null,
        position,
        estimated_wait: estimatedWait,
        status:         'waiting',
      })
      .select('*, customer(*), service(*), staff(*)')
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async callNext(): Promise<ApiResponse<QueueEntry | null>> {
    const supabase = getSupabaseClient()

    const { data: next, error } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1)
      .single() as any

    if (error || !next) return { data: null, error: null }

    const { data: updated, error: updateErr } = await supabase
      .from('queue')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', next.id)
      .select('*, customer(*), service(*), staff(*)')
      .single() as any

    if (updateErr) return { data: null, error: updateErr.message }
    return { data: updated, error: null }
  },

  async updateStatus(
    queueId: string,
    status:  QueueEntry['status']
  ): Promise<ApiResponse<QueueEntry>> {
    const supabase = getSupabaseClient()

    const timestamps: Record<string, string> = {}
    if (status === 'called')  timestamps.called_at  = new Date().toISOString()
    if (status === 'serving') timestamps.served_at  = new Date().toISOString()
    if (status === 'done')    timestamps.done_at    = new Date().toISOString()

    const { data, error } = await supabase
      .from('queue')
      .update({ status, ...timestamps })
      .eq('id', queueId)
      .select('*, customer(*), service(*), staff(*)')
      .single() as any

    if (error) return { data: null, error: error.message }

    if (status === 'done' || status === 'cancelled') {
      await this.reorderQueue()
    }

    return { data, error: null }
  },

  async reorderQueue(): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: entries } = await supabase
      .from('queue')
      .select('id')
      .in('status', ['waiting', 'called'])
      .order('position', { ascending: true })

    if (!entries) return

    const updates = entries.map((e, idx) => ({ id: e.id, position: idx + 1 }))
    await Promise.all(
      updates.map(u =>
        supabase.from('queue').update({ position: u.position }).eq('id', u.id)
      )
    )
  },

  async getQueueStats(date?: string): Promise<ApiResponse<QueueStats>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .rpc('fn_calculate_queue_wait', { p_date: date ?? new Date().toISOString().split('T')[0] })

    if (error) return { data: null, error: error.message }

    const row = data?.[0]
    return {
      data: {
        queue_length:   row?.queue_length   ?? 0,
        active_staff:   row?.active_staff   ?? 0,
        avg_duration:   row?.avg_duration   ?? 0,
        estimated_wait: row?.estimated_wait ?? 0,
      },
      error: null,
    }
  },

 subscribeToQueue(callback: (payload: unknown) => void) {
  const supabase = getSupabaseClient()
  const channelName = `queue-realtime-${Date.now()}`
  return supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, callback)
    .subscribe()
},
}
