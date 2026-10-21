import { getSupabaseClient } from '@/lib/supabase'
import { addDays, format, parseISO, differenceInDays } from 'date-fns'
import type { Supplier, PurchaseOrder, InventoryExpiry, InventoryWastage, RetailProduct, ApiResponse } from '@/types'

export const inventoryAdvancedService = {
  // ── Suppliers ────────────────────────────────────────────────
  async getAllSuppliers(): Promise<ApiResponse<Supplier[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('suppliers').select('*').eq('is_active', true).order('name')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async createSupplier(supplier: Omit<Supplier, 'id' | 'total_orders' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Supplier>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('suppliers').insert({ ...supplier, total_orders: 0 }).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async updateSupplierRating(supplierId: string, rating: number): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    await supabase.from('suppliers').update({ rating }).eq('id', supplierId)
    return { data: undefined, error: null }
  },

  // ── Purchase Orders ──────────────────────────────────────────
  async createPurchaseOrder(payload: {
    supplier_id: string
    branch_id?:  string
    items:       Array<{ inventory_id: string; quantity: number; unit_price: number }>
    notes?:      string
    created_by?: string
  }): Promise<ApiResponse<PurchaseOrder>> {
    const supabase = getSupabaseClient()

    const subtotal = payload.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const taxAmount = Math.round(subtotal * 0.08 * 100) / 100
    const total    = Math.round((subtotal + taxAmount) * 100) / 100

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        po_number:     '',
        supplier_id:   payload.supplier_id,
        branch_id:     payload.branch_id ?? null,
        status:        'draft',
        order_date:    format(new Date(), 'yyyy-MM-dd'),
        expected_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        subtotal,
        tax_amount:    taxAmount,
        total,
        payment_status: 'unpaid',
        notes:         payload.notes ?? null,
        created_by:    payload.created_by ?? null,
      })
      .select().single() as any

    if (poErr || !po) return { data: null, error: poErr?.message ?? 'PO creation failed' }

    await supabase.from('purchase_order_items').insert(
      payload.items.map(i => ({
        po_id:             po.id,
        inventory_id:      i.inventory_id,
        quantity_ordered:  i.quantity,
        quantity_received: 0,
        unit_price:        i.unit_price,
        total:             Math.round(i.quantity * i.unit_price * 100) / 100,
      }))
    )

    await supabase.from('suppliers')
      .update({ total_orders: supabase.rpc as never })
      .eq('id', payload.supplier_id)

    return { data: { ...po, items: [] }, error: null }
  },

  async receivePurchaseOrder(poId: string, receivedItems: Array<{ po_item_id: string; quantity_received: number; expiry_date?: string }>): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()

    for (const item of receivedItems) {
      const { data: poItem } = await supabase
        .from('purchase_order_items').select('inventory_id, unit_price').eq('id', item.po_item_id).single() as any

      if (!poItem) continue

      await supabase.from('purchase_order_items')
        .update({ quantity_received: item.quantity_received }).eq('id', item.po_item_id)

      const { data: inv } = await supabase
        .from('inventory').select('quantity').eq('id', poItem.inventory_id).single() as any

      if (inv) {
        await supabase.from('inventory').update({
          quantity:       inv.quantity + item.quantity_received,
          last_restocked: new Date().toISOString(),
          cost_per_unit:  poItem.unit_price,
        }).eq('id', poItem.inventory_id)
      }

      if (item.expiry_date) {
        await supabase.from('inventory_expiry').insert({
          inventory_id: poItem.inventory_id,
          quantity:     item.quantity_received,
          expiry_date:  item.expiry_date,
          status:       'active',
        })
      }
    }

    await supabase.from('purchase_orders')
      .update({ status: 'received', received_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', poId)

    return { data: undefined, error: null }
  },

  async getPurchaseOrders(status?: PurchaseOrder['status']): Promise<ApiResponse<PurchaseOrder[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('purchase_orders').select('*, supplier(*), items:purchase_order_items(*, inventory(*))')
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Expiry Tracking ──────────────────────────────────────────
  async getExpiringItems(daysAhead = 30): Promise<ApiResponse<InventoryExpiry[]>> {
    const supabase = getSupabaseClient()
    const cutoff = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd')
    const today  = format(new Date(), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('inventory_expiry')
      .select('*, inventory(*)')
      .gte('expiry_date', today)
      .lte('expiry_date', cutoff)
      .eq('status', 'active')
      .order('expiry_date')

    if (error) return { data: null, error: error.message }

    const withStatus = (data ?? []).map(item => ({
      ...item,
      status: differenceInDays(parseISO(item.expiry_date), new Date()) <= 7
        ? 'expiring_soon' as const
        : 'active' as const,
    }))

    return { data: withStatus, error: null }
  },

  async getExpiredItems(): Promise<ApiResponse<InventoryExpiry[]>> {
    const supabase = getSupabaseClient()
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('inventory_expiry').select('*, inventory(*)')
      .lt('expiry_date', today).eq('status', 'active')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async disposeExpiredItem(expiryId: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { data: item } = await supabase
      .from('inventory_expiry').select('inventory_id, quantity').eq('id', expiryId).single() as any
    if (!item) return { data: null, error: 'Item not found' }

    await supabase.from('inventory_expiry').update({ status: 'disposed' }).eq('id', expiryId)

    const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventory_id).single() as any
    if (inv) {
      await supabase.from('inventory')
        .update({ quantity: Math.max(0, inv.quantity - item.quantity) })
        .eq('id', item.inventory_id)
    }

    return { data: undefined, error: null }
  },

  // ── Wastage ──────────────────────────────────────────────────
  async recordWastage(wastage: Omit<InventoryWastage, 'id' | 'recorded_at'>): Promise<ApiResponse<InventoryWastage>> {
    const supabase = getSupabaseClient()
    const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', wastage.inventory_id).single() as any
    if (!inv) return { data: null, error: 'Item not found' }

    await supabase.from('inventory')
      .update({ quantity: Math.max(0, inv.quantity - wastage.quantity) })
      .eq('id', wastage.inventory_id)

    const { data, error } = await supabase
      .from('inventory_wastage').insert({ ...wastage, recorded_at: new Date().toISOString() })
      .select('*, inventory(*), staff(*)').single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getWastageReport(): Promise<ApiResponse<{ item: string; total_quantity: number; total_cost: number; reason_breakdown: Record<string, number> }[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('inventory_wastage').select('*, inventory(name, cost_per_unit)')

    if (error) return { data: null, error: error.message }

    const grouped: Record<string, { total_quantity: number; total_cost: number; reason_breakdown: Record<string, number> }> = {}

    ;(data ?? []).forEach(w => {
      const name = (w.inventory as { name: string })?.name ?? 'Unknown'
      const cost = ((w.inventory as { cost_per_unit: number })?.cost_per_unit ?? 0) * w.quantity
      if (!grouped[name]) grouped[name] = { total_quantity: 0, total_cost: 0, reason_breakdown: {} }
      grouped[name].total_quantity += w.quantity
      grouped[name].total_cost    += cost
      grouped[name].reason_breakdown[w.reason] = (grouped[name].reason_breakdown[w.reason] ?? 0) + 1
    })

    return {
      data: Object.entries(grouped).map(([item, v]) => ({ item, ...v })).sort((a, b) => b.total_cost - a.total_cost),
      error: null,
    }
  },

  // ── Barcode ──────────────────────────────────────────────────
  async scanBarcode(barcode: string, action: 'check' | 'restock' | 'deduct' | 'sale', quantity?: number, scannedBy?: string): Promise<ApiResponse<{ item: import('@/types').InventoryItem | null; retail?: RetailProduct | null }>> {
    const supabase = getSupabaseClient()

    const { data: item } = await supabase
      .from('inventory').select('*').eq('barcode', barcode).single() as any

    if (!item) {
      const { data: retail } = await supabase
        .from('retail_products').select('*').eq('barcode', barcode).single() as any
      return { data: { item: null, retail }, error: null }
    }

    await supabase.from('barcode_scans').insert({
      barcode, inventory_id: item.id, action, quantity: quantity ?? null, scanned_by: scannedBy ?? null,
    })

    if (action === 'restock' && quantity) {
      await supabase.from('inventory')
        .update({ quantity: item.quantity + quantity, last_restocked: new Date().toISOString() })
        .eq('id', item.id)
    } else if (action === 'deduct' && quantity) {
      await supabase.from('inventory')
        .update({ quantity: Math.max(0, item.quantity - quantity) })
        .eq('id', item.id)
    }

    return { data: { item }, error: null }
  },

  // ── Retail Products ──────────────────────────────────────────
  async getRetailProducts(): Promise<ApiResponse<RetailProduct[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('retail_products').select('*').eq('is_active', true).order('name')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getRetailSalesReport(): Promise<ApiResponse<{ product_name: string; units_sold: number; revenue: number; commission: number }[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('retail_sales').select('*, product:retail_products(name)')

    if (error) return { data: null, error: error.message }

    const grouped: Record<string, { units_sold: number; revenue: number; commission: number }> = {}
    ;(data ?? []).forEach(s => {
      const name = (s.product as { name: string })?.name ?? 'Unknown'
      if (!grouped[name]) grouped[name] = { units_sold: 0, revenue: 0, commission: 0 }
      grouped[name].units_sold += s.quantity
      grouped[name].revenue   += s.total
      grouped[name].commission += s.total * (s.commission_pct / 100)
    })

    return {
      data: Object.entries(grouped).map(([product_name, v]) => ({ product_name, ...v })).sort((a, b) => b.revenue - a.revenue),
      error: null,
    }
  },
}
