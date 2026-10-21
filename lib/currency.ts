/**
 * Multi-Currency Support
 * Replaces hardcoded USD/PKR amounts.
 * Uses currency.js for precise decimal arithmetic.
 */

import currencyJs from 'currency.js'

// ── Supported Currencies ──────────────────────────────────────────────────────

export interface CurrencyConfig {
  code:      string
  symbol:    string
  precision: number
  separator: string
  decimal:   string
  pattern:   string      // !# = symbol before, #! = symbol after
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$',   precision: 2, separator: ',', decimal: '.', pattern: '!#' },
  GBP: { code: 'GBP', symbol: '£',   precision: 2, separator: ',', decimal: '.', pattern: '!#' },
  EUR: { code: 'EUR', symbol: '€',   precision: 2, separator: '.', decimal: ',', pattern: '#!' },
  PKR: { code: 'PKR', symbol: 'Rs.', precision: 0, separator: ',', decimal: '.', pattern: '!#' },
  AED: { code: 'AED', symbol: 'د.إ', precision: 2, separator: ',', decimal: '.', pattern: '#!' },
  SAR: { code: 'SAR', symbol: 'ر.س', precision: 2, separator: ',', decimal: '.', pattern: '#!' },
  INR: { code: 'INR', symbol: '₹',   precision: 2, separator: ',', decimal: '.', pattern: '!#' },
  BDT: { code: 'BDT', symbol: '৳',   precision: 2, separator: ',', decimal: '.', pattern: '!#' },
  MYR: { code: 'MYR', symbol: 'RM',  precision: 2, separator: ',', decimal: '.', pattern: '!#' },
  SGD: { code: 'SGD', symbol: 'S$',  precision: 2, separator: ',', decimal: '.', pattern: '!#' },
}

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY ?? 'USD'

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Create a currency value with precise decimal arithmetic.
 */
export function money(amount: number, currencyCode?: string): currencyJs {
  const code   = currencyCode ?? DEFAULT_CURRENCY
  const config = CURRENCIES[code.toUpperCase()]

  return currencyJs(amount, {
    precision:  config?.precision ?? 2,
    separator:  config?.separator ?? ',',
    decimal:    config?.decimal   ?? '.',
    symbol:     config?.symbol    ?? '$',
    pattern:    config?.pattern   ?? '!#',
  })
}

/**
 * Format a number as currency string for display.
 */
export function formatMoney(amount: number, currencyCode?: string): string {
  return money(amount, currencyCode).format()
}

/**
 * Add two monetary values safely.
 */
export function addMoney(a: number, b: number, currencyCode?: string): number {
  return money(a, currencyCode).add(b).value
}

/**
 * Apply a percentage discount.
 */
export function applyDiscount(amount: number, discountPct: number, currencyCode?: string): number {
  const discount = money(amount, currencyCode).multiply(discountPct / 100)
  return money(amount, currencyCode).subtract(discount).value
}

/**
 * Calculate tax amount.
 */
export function calculateTax(amount: number, taxRate: number, currencyCode?: string): number {
  return money(amount, currencyCode).multiply(taxRate).value
}

/**
 * Round to currency precision.
 */
export function roundMoney(amount: number, currencyCode?: string): number {
  return money(amount, currencyCode).value
}

/**
 * Get currency config from tenant or default.
 */
export function getCurrencyConfig(currencyCode?: string): CurrencyConfig {
  const code = (currencyCode ?? DEFAULT_CURRENCY).toUpperCase()
  return CURRENCIES[code] ?? CURRENCIES['USD']
}

/**
 * Convert amount between currencies using exchange rate.
 * For production: integrate with a real exchange rate API (e.g. Open Exchange Rates).
 */
export function convertCurrency(
  amount:       number,
  fromCurrency: string,
  toCurrency:   string,
  exchangeRate: number     // fromCurrency → toCurrency
): number {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amount
  return money(amount, toCurrency).multiply(exchangeRate).value
}

// ── Tax Configuration ─────────────────────────────────────────────────────────

export interface TaxConfig {
  name:        string
  rate:        number
  inclusive:   boolean    // Is tax included in price or added on top?
  applies_to:  'all' | 'services' | 'products'
  registration_no?: string
}

export const DEFAULT_TAX_CONFIGS: Record<string, TaxConfig> = {
  PKR: { name: 'GST',     rate: 0.17, inclusive: false, applies_to: 'all' },
  USD: { name: 'Sales Tax', rate: 0.08, inclusive: false, applies_to: 'all' },
  GBP: { name: 'VAT',     rate: 0.20, inclusive: true,  applies_to: 'all' },
  EUR: { name: 'VAT',     rate: 0.19, inclusive: true,  applies_to: 'all' },
  AED: { name: 'VAT',     rate: 0.05, inclusive: false, applies_to: 'all' },
  SAR: { name: 'VAT',     rate: 0.15, inclusive: false, applies_to: 'all' },
  INR: { name: 'GST',     rate: 0.18, inclusive: false, applies_to: 'all' },
}

export function getDefaultTaxConfig(currencyCode: string): TaxConfig {
  return DEFAULT_TAX_CONFIGS[currencyCode.toUpperCase()] ?? {
    name: 'Tax', rate: parseFloat(process.env.DEFAULT_TAX_RATE ?? '0.08'),
    inclusive: false, applies_to: 'all',
  }
}

/**
 * Calculate price breakdown with tax (inclusive or exclusive).
 */
export function calculatePriceWithTax(
  baseAmount:  number,
  taxConfig:   TaxConfig,
  currencyCode?: string
): {
  base:      number
  tax:       number
  total:     number
  inclusive: boolean
} {
  if (taxConfig.inclusive) {
    // Tax is already included in the price
    const tax  = money(baseAmount).multiply(taxConfig.rate / (1 + taxConfig.rate)).value
    const base = money(baseAmount).subtract(tax).value
    return { base: roundMoney(base, currencyCode), tax: roundMoney(tax, currencyCode), total: baseAmount, inclusive: true }
  } else {
    // Tax added on top
    const tax   = calculateTax(baseAmount, taxConfig.rate, currencyCode)
    const total = addMoney(baseAmount, tax, currencyCode)
    return { base: baseAmount, tax: roundMoney(tax, currencyCode), total: roundMoney(total, currencyCode), inclusive: false }
  }
}
