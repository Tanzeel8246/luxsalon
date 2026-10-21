import { getSupabaseClient } from '@/lib/supabase'
import type { InventoryItem, InventoryAlert, ApiResponse } from '@/types'

export const inventoryService = {
  async getAll(): Promise<ApiResponse<InventoryItem[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getById(id: string): Promise<ApiResponse<InventoryItem>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('inventory').select('*').eq('id', id).single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async create(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<InventoryItem>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('inventory').insert(item).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async update(id: string, updates: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('inventory').update(updates).eq('id', id).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async restock(id: string, quantity: number): Promise<ApiResponse<InventoryItem>> {
    const supabase = getSupabaseClient()
    const { data: current } = await supabase.from('inventory').select('quantity').eq('id', id).single() as any
    if (!current) return { data: null, error: 'Item not found' }

    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: current.quantity + quantity, last_restocked: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getLowStockAlerts(): Promise<ApiResponse<InventoryAlert[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .filter('quantity', 'lte', supabase.rpc as unknown as number)

    const { data: items, error: itemsErr } = await supabase
      .from('inventory')
      .select('*')

    if (itemsErr) return { data: null, error: itemsErr.message }

    const alerts: InventoryAlert[] = (items ?? [])
      .filter(item => item.quantity <= item.min_threshold)
      .map(item => ({
        item,
        severity: item.quantity === 0
          ? 'critical'
          : item.quantity <= item.min_threshold * 0.5
            ? 'critical'
            : 'warning',
        deficit: Math.max(0, item.min_threshold - item.quantity),
      }))
      .sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1))

    return { data: alerts, error: null }
  },

  async getLowStockCount(): Promise<number> {
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('inventory').select('id, quantity, min_threshold')
    return (data ?? []).filter(item => item.quantity <= item.min_threshold).length
  },

  async deductForService(serviceId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: usage } = await supabase
      .from('service_inventory')
      .select('inventory_id, quantity_used')
      .eq('service_id', serviceId)

    if (!usage) return

    await Promise.all(
      usage.map(async u => {
        const { data: item } = await supabase.from('inventory').select('quantity').eq('id', u.inventory_id).single() as any
        if (!item) return
        return supabase
          .from('inventory')
          .update({ quantity: Math.max(0, item.quantity - u.quantity_used) })
          .eq('id', u.inventory_id)
      })
    )
  },

subscribeToAlerts(callback: (payload: unknown) => void) {
  const supabase = getSupabaseClient()
  const channelName = `inventory-alerts-${Date.now()}`
  return supabase
    .channel(channelName)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, callback)
    .subscribe()
},
}
