import { getSupabaseClient } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import type { ApiResponse } from '@/types'

export const branchService = {
  async getAll(): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('branches')
      .select('*, manager:staff(*)')
      .eq('is_active', true)
      .order('name')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getById(id: string): Promise<ApiResponse<any>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('branches').select('*, manager:staff(*)').eq('id', id).single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async create(branch: any): Promise<ApiResponse<any>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase.from('branches').insert(branch).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async update(id: string, updates: any): Promise<ApiResponse<any>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('branches').update(updates).eq('id', id).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getAllBranchStats(): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient() as any
    const { data: branches } = await supabase.from('branches').select('*').eq('is_active', true)
    if (!branches) return { data: [], error: null }

    const today = format(new Date(), 'yyyy-MM-dd')

    const stats: any[] = await Promise.all(branches.map(async (branch: any) => {
      const [{ data: appts }, { data: queue }, { data: branchStaff }] = await Promise.all([
        supabase.from('appointments').select('total_price, status, rating')
          .eq('branch_id', branch.id)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`),
        supabase.from('queue').select('id', { count: 'exact', head: true })
          .in('status', ['waiting', 'called', 'serving']),
        supabase.from('branch_staff').select('id', { count: 'exact', head: true })
          .eq('branch_id', branch.id).is('end_date', null),
      ])

      const completed  = (appts ?? []).filter((a: any) => a.status === 'completed')
      const revenue    = completed.reduce((s: number, a: any) => s + a.total_price, 0)
      const ratings    = completed.filter((a: any) => a.rating).map((a: any) => a.rating as number)
      const avgRating  = ratings.length ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0

      return {
        branch,
        today_revenue: Math.round(revenue * 100) / 100,
        appointments:  appts?.length ?? 0,
        queue_count:   queue?.length ?? 0,
        active_staff:  branchStaff?.length ?? 0,
        avg_rating:    Math.round(avgRating * 10) / 10,
      }
    }))

    return { data: stats, error: null }
  },

  async transferStaff(staffId: string, toBranchId: string, fromBranchId?: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient() as any

    if (fromBranchId) {
      await supabase.from('branch_staff')
        .update({ end_date: format(new Date(), 'yyyy-MM-dd') })
        .eq('staff_id', staffId)
        .eq('branch_id', fromBranchId)
    }

    await supabase.from('branch_staff').insert({
      staff_id:   staffId,
      branch_id:  toBranchId,
      is_primary: true,
      start_date: format(new Date(), 'yyyy-MM-dd'),
    })

    await supabase.from('staff').update({ primary_branch_id: toBranchId }).eq('id', staffId)
    return { data: undefined, error: null }
  },

  async requestInventoryTransfer(payload: {
    from_branch_id: string
    to_branch_id:   string
    inventory_id:   string
    quantity:       number
    requested_by:   string
    notes?:         string
  }): Promise<ApiResponse<any>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('inventory_transfers').insert(payload).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async processTransfer(transferId: string, approvedBy: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient() as any
    const { data: transfer } = await supabase
      .from('inventory_transfers').select('*').eq('id', transferId).single() as any
    if (!transfer) return { data: null, error: 'Transfer not found' }

    const { data: fromItem } = await supabase
      .from('inventory').select('quantity').eq('id', transfer.inventory_id)
      .eq('branch_id', transfer.from_branch_id).single() as any

    if (!fromItem || fromItem.quantity < transfer.quantity)
      return { data: null, error: 'Insufficient stock in source branch' }

    await Promise.all([
      supabase.from('inventory')
        .update({ quantity: fromItem.quantity - transfer.quantity })
        .eq('id', transfer.inventory_id).eq('branch_id', transfer.from_branch_id),
      supabase.from('inventory_transfers')
        .update({ status: 'completed', approved_by: approvedBy })
        .eq('id', transferId),
    ])

    return { data: undefined, error: null }
  },

  async calculateFranchiseRoyalties(branchId: string, periodStart: string, periodEnd: string): Promise<ApiResponse<any>> {
    const supabase = getSupabaseClient() as any

    const { data: branch } = await supabase
      .from('branches').select('royalty_rate, is_franchise').eq('id', branchId).single() as any

    if (!branch?.is_franchise) return { data: null, error: 'Not a franchise branch' }

    const { data: appts } = await supabase
      .from('appointments').select('total_price')
      .eq('branch_id', branchId).eq('status', 'completed')
      .gte('start_time', `${periodStart}T00:00:00`)
      .lte('start_time', `${periodEnd}T23:59:59`)

    const grossRevenue    = (appts ?? []).reduce((s: number, a: any) => s + a.total_price, 0)
    const royaltyAmount   = Math.round(grossRevenue * branch.royalty_rate * 100) / 100

    const { data, error } = await supabase.from('franchise_royalties').insert({
      branch_id:      branchId,
      period_start:   periodStart,
      period_end:     periodEnd,
      gross_revenue:  grossRevenue,
      royalty_rate:   branch.royalty_rate,
      royalty_amount: royaltyAmount,
      status:         'pending',
    }).select().single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },
}
