import { getSupabaseClient } from '@/lib/supabase'
import { parseISO } from 'date-fns'
import { isPeakHour } from '@/lib/utils'
import type { PriceBreakdown, ApiResponse } from '@/types'

const PEAK_MULTIPLIER   = 1.25
const DEMAND_MULTIPLIER = 1.15
const LOYALTY_DISCOUNT  = 0.10

export const pricingService = {
  async calculatePrice(
    serviceId:  string,
    startTime:  string,
    customerId: string
  ): Promise<PriceBreakdown> {
    const supabase = getSupabaseClient()

    const [{ data: service }, { data: customer }, { data: activeRules }] = await Promise.all([
      supabase.from('services').select('base_price').eq('id', serviceId).single() as any,
      supabase.from('customers').select('tier, loyalty_points').eq('id', customerId).single() as any,
      supabase.from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .or(`service_id.eq.${serviceId},service_id.is.null`),
    ])

    const basePrice    = service?.base_price ?? 0
    const date         = parseISO(startTime)
    let   multiplier   = 1.0

    const peakSurcharge  = isPeakHour(date) ? basePrice * (PEAK_MULTIPLIER - 1) : 0
    if (isPeakHour(date)) multiplier *= PEAK_MULTIPLIER

    const demandRule = activeRules?.find(r => r.rule_type === 'demand')
    const demandSurcharge = demandRule
      ? basePrice * (demandRule.multiplier - 1)
      : 0
    if (demandRule) multiplier *= demandRule.multiplier

    let loyaltyDiscount = 0
    if (customer?.tier === 'gold' || customer?.tier === 'platinum') {
      loyaltyDiscount = basePrice * LOYALTY_DISCOUNT
      multiplier     -= LOYALTY_DISCOUNT
    }

    const promoRule     = activeRules?.find(r => r.rule_type === 'promo')
    const promoDiscount = promoRule
      ? basePrice * (1 - promoRule.multiplier)
      : 0

    const total = Math.max(0, basePrice + peakSurcharge + demandSurcharge - loyaltyDiscount - promoDiscount)

    return {
      base_price:       basePrice,
      peak_surcharge:   peakSurcharge,
      demand_surcharge: demandSurcharge,
      loyalty_discount: loyaltyDiscount,
      promo_discount:   promoDiscount,
      total:            Math.round(total * 100) / 100,
      multiplier:       Math.round(multiplier * 100) / 100,
    }
  },

  async createRule(rule: {
    name:        string
    rule_type:   'peak_hours' | 'demand' | 'seasonal' | 'loyalty' | 'promo'
    service_id?: string
    multiplier:  number
    conditions:  Record<string, unknown>
    valid_from?: string
    valid_until?: string
  }): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('pricing_rules').insert(rule).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async toggleRule(ruleId: string, isActive: boolean): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('pricing_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId)
      .select()
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getAllRules(): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('pricing_rules').select('*').order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },
}
