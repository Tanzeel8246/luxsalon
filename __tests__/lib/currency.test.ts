/**
 * Currency Tests — precision arithmetic
 */

import { money, formatMoney, calculateTax, applyDiscount, calculatePriceWithTax, getDefaultTaxConfig } from '@/lib/currency'

describe('Currency Precision', () => {
  it('avoids floating point errors', () => {
    // Classic JS floating point bug: 0.1 + 0.2 = 0.30000000000000004
    const result = money(0.1).add(0.2).value
    expect(result).toBe(0.30)
  })

  it('rounds to correct precision', () => {
    expect(money(100, 'PKR').multiply(0.17).value).toBe(17)
    expect(money(99.99, 'USD').multiply(0.08).value).toBe(8)
  })

  it('handles PKR (zero decimal)', () => {
    const formatted = formatMoney(1500.7, 'PKR')
    expect(formatted).toBeTruthy()
    // PKR has precision 0 — should round to integer
  })
})

describe('Tax Calculation', () => {
  it('calculates exclusive tax correctly', () => {
    const tax = calculateTax(100, 0.17, 'PKR')
    expect(tax).toBe(17)
  })

  it('calculates inclusive VAT correctly', () => {
    const config = { ...getDefaultTaxConfig('GBP'), inclusive: true }
    const result = calculatePriceWithTax(120, config, 'GBP')  // £120 inc 20% VAT

    expect(result.inclusive).toBe(true)
    expect(result.total).toBe(120)
    expect(Math.round(result.tax)).toBe(20)
    expect(Math.round(result.base)).toBe(100)
  })

  it('total = base + tax (exclusive)', () => {
    const config = getDefaultTaxConfig('PKR')
    const result = calculatePriceWithTax(100, { ...config, inclusive: false }, 'PKR')

    expect(result.base).toBe(100)
    expect(result.tax).toBe(17)
    expect(result.total).toBe(117)
  })
})

describe('Discount Calculation', () => {
  it('applies percentage discount correctly', () => {
    expect(applyDiscount(100, 10, 'USD')).toBe(90)
    expect(applyDiscount(200, 50, 'USD')).toBe(100)
  })

  it('handles 0% discount', () => {
    expect(applyDiscount(100, 0, 'USD')).toBe(100)
  })

  it('handles 100% discount', () => {
    expect(applyDiscount(100, 100, 'USD')).toBe(0)
  })
})

describe('Default Tax Configs', () => {
  it('returns correct rates for each country', () => {
    expect(getDefaultTaxConfig('PKR').rate).toBe(0.17)
    expect(getDefaultTaxConfig('GBP').rate).toBe(0.20)
    expect(getDefaultTaxConfig('AED').rate).toBe(0.05)
    expect(getDefaultTaxConfig('USD').rate).toBe(0.08)
  })

  it('GBP and EUR are inclusive (VAT included in price)', () => {
    expect(getDefaultTaxConfig('GBP').inclusive).toBe(true)
    expect(getDefaultTaxConfig('EUR').inclusive).toBe(true)
    expect(getDefaultTaxConfig('PKR').inclusive).toBe(false)
  })
})
