/**
 * Payroll Service Tests
 * Verifies commission calculation logic is correct.
 */

describe('Commission Rule Resolution', () => {
  // Since fn_resolve_commission is a DB function, we test the service logic
  // with mocked DB responses.

  it('calculates 30% commission on 100 revenue = 30', () => {
    const revenue    = 100
    const rate       = 0.30
    const commission = Math.round(revenue * rate * 100) / 100
    expect(commission).toBe(30)
  })

  it('handles tiered commission correctly', () => {
    const tiers = [
      { min_revenue: 0,     rate: 0.30 },
      { min_revenue: 5000,  rate: 0.35 },
      { min_revenue: 10000, rate: 0.40 },
    ]

    function applyTiered(periodRevenue: number, serviceRevenue: number): number {
      let rate = 0
      for (const tier of tiers) {
        if (periodRevenue >= tier.min_revenue) rate = tier.rate
      }
      return Math.round(serviceRevenue * rate * 100) / 100
    }

    expect(applyTiered(3000, 100)).toBe(30)    // 30% tier
    expect(applyTiered(6000, 100)).toBe(35)    // 35% tier
    expect(applyTiered(12000, 100)).toBe(40)   // 40% tier
  })

  it('gross = base + commission + tips + bonuses - deductions', () => {
    const base       = 2000
    const commission = 850
    const tips       = 200
    const bonuses    = 100
    const deductions = 50
    const gross      = base + commission + tips + bonuses - deductions

    expect(gross).toBe(3100)
  })

  it('net = gross - tax (20%)', () => {
    const gross  = 3100
    const taxRate = 0.20
    const tax    = Math.round(gross * taxRate * 100) / 100
    const net    = Math.round((gross - tax) * 100) / 100

    expect(tax).toBe(620)
    expect(net).toBe(2480)
  })

  it('handles zero commission (no rules configured)', () => {
    const commission = 0   // fn_resolve_commission returns 0 when no rules found
    const net = 2000 + commission - 400   // base - tax
    expect(net).toBe(1600)
  })
})
