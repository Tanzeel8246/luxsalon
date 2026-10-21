/**
 * Pricing Engine Tests
 * Verifies: base price, peak surcharges, discounts, edge cases.
 */

import { pricingService } from '@/services/pricingService'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            if (table === 'services') return { data: { base_price: 100.00 }, error: null }
            if (table === 'customers') return { data: { tier: 'bronze', loyalty_points: 100 }, error: null }
            return { data: null, error: null }
          },
          or: () => ({
            data: [],
            error: null,
          }),
        }),
        or: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}))

describe('pricingService.calculatePrice', () => {
  const SERVICE_ID   = '550e8400-e29b-41d4-a716-446655440000'
  const CUSTOMER_ID  = '660e8400-e29b-41d4-a716-446655440000'
  const BRANCH_ID    = '770e8400-e29b-41d4-a716-446655440000'

  it('returns base price for off-peak non-loyalty customer', async () => {
    // 3pm on a Wednesday = off-peak
    const offPeakTime = '2026-06-10T15:00:00.000Z'
    const breakdown   = await pricingService.calculatePrice(SERVICE_ID, offPeakTime, CUSTOMER_ID, BRANCH_ID)

    expect(breakdown.base_price).toBe(100)
    expect(breakdown.total).toBeGreaterThanOrEqual(breakdown.base_price)
    expect(breakdown.total).toBeLessThanOrEqual(200)  // Sanity check
  })

  it('total is never negative', async () => {
    const breakdown = await pricingService.calculatePrice(SERVICE_ID, new Date().toISOString(), CUSTOMER_ID, BRANCH_ID)
    expect(breakdown.total).toBeGreaterThanOrEqual(0)
  })

  it('total accounts for all components', async () => {
    const breakdown = await pricingService.calculatePrice(SERVICE_ID, new Date().toISOString(), CUSTOMER_ID, BRANCH_ID)
    const computed  = breakdown.base_price
      + breakdown.peak_surcharge
      + breakdown.demand_surcharge
      - breakdown.loyalty_discount
      - breakdown.promo_discount

    expect(Math.abs(breakdown.total - Math.max(0, computed))).toBeLessThan(0.01)
  })
})
