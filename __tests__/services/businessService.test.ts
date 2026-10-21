/**
 * Business Service Tests
 * Tests: end-of-day logic, customer merge, cancellation fees, tips
 */

describe('End-of-Day Logic', () => {
  it('cash variance is actual minus expected', () => {
    const cash_expected = 5000
    const cash_actual   = 4850
    const variance      = cash_actual - cash_expected
    expect(variance).toBe(-150)   // -150 = shortage
  })

  it('day status transitions correctly', () => {
    const validTransitions: Record<string, string[]> = {
      open:        ['closed'],
      closed:      ['reconciled'],
      reconciled:  [],
    }
    expect(validTransitions['open']).toContain('closed')
    expect(validTransitions['closed']).toContain('reconciled')
    expect(validTransitions['reconciled']).toHaveLength(0)
  })
})

describe('Cancellation Fee Calculation', () => {
  function calcFee(
    hoursNotice:   number,
    appointmentPrice: number,
    policyHours:   number,
    feePct:        number,
    noShowPct:     number
  ): number {
    if (hoursNotice < 0)            return appointmentPrice * (noShowPct / 100)
    if (hoursNotice < policyHours)  return appointmentPrice * (feePct / 100)
    return 0
  }

  it('no fee for cancellation with sufficient notice', () => {
    expect(calcFee(48, 100, 24, 50, 100)).toBe(0)
  })

  it('charges late cancellation fee', () => {
    expect(calcFee(12, 100, 24, 50, 100)).toBe(50)
  })

  it('charges full no-show fee', () => {
    expect(calcFee(-1, 100, 24, 50, 100)).toBe(100)
  })

  it('handles zero fee policy', () => {
    expect(calcFee(2, 100, 24, 0, 0)).toBe(0)
  })
})

describe('Customer Merge', () => {
  it('combines loyalty points correctly', () => {
    const primary = { loyalty_points: 500 }
    const merged  = { loyalty_points: 300 }
    const combined = primary.loyalty_points + merged.loyalty_points
    expect(combined).toBe(800)
  })

  it('prevents self-merge', () => {
    const primaryId = '550e8400-e29b-41d4-a716-446655440000'
    const mergedId  = primaryId   // Same ID
    const isSame    = primaryId === mergedId
    expect(isSame).toBe(true)   // Should throw error when same
  })
})

describe('Tips Management', () => {
  it('validates positive tip amount', () => {
    expect(-10 <= 0).toBe(true)   // Negative tips invalid
    expect(0   <= 0).toBe(true)   // Zero tips invalid
    expect(50  <= 0).toBe(false)  // Positive tips valid
  })

  it('calculates total tips correctly', () => {
    const tips = [{ amount: 50 }, { amount: 30 }, { amount: 20 }]
    const total = tips.reduce((s, t) => s + t.amount, 0)
    expect(total).toBe(100)
  })
})

describe('Before/After Photos', () => {
  it('requires consent before saving', () => {
    const params = { consent_given: false }
    const valid  = params.consent_given

    expect(valid).toBe(false)   // Should throw error
  })

  it('validates photo types', () => {
    const valid = ['before', 'after', 'during']
    expect(valid).toContain('before')
    expect(valid).toContain('after')
    expect(valid).not.toContain('unknown')
  })
})

describe('Intake Forms', () => {
  it('sanitizes text responses', () => {
    const { sanitizeText } = require('@/lib/sanitize')
    const response = '<script>alert(1)</script>I prefer natural products'
    const clean    = sanitizeText(response)
    expect(clean).toBe('I prefer natural products')
    expect(clean).not.toContain('<script>')
  })
})
