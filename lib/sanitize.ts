/**
 * Input Sanitization & Validation
 * Prevents XSS, injection, and malformed data.
 */

import sanitizeHtml from 'sanitize-html'
import validator    from 'validator'
import xss          from 'xss'

// ── HTML Sanitization ─────────────────────────────────────────────────────────

const ALLOWED_TAGS: string[] = []   // No HTML allowed in user inputs

/**
 * Strip all HTML tags from a string — use for notes, names, etc.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return ''
  return sanitizeHtml(String(input), {
    allowedTags:       ALLOWED_TAGS,
    allowedAttributes: {},
  }).trim()
}

/**
 * Sanitize rich text that allows basic formatting (descriptions, etc.)
 */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== 'string') return ''
  return sanitizeHtml(String(input), {
    allowedTags:       ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {},
  }).trim()
}

/**
 * XSS-safe output for rendering user content.
 */
export function escapeForOutput(input: string): string {
  return xss(input)
}

// ── Validation Helpers ─────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return validator.isEmail(email)
}

export function isValidPhone(phone: string, locale?: string): boolean {
  return validator.isMobilePhone(phone, locale as never ?? 'any', { strictMode: false })
}

export function isValidUUID(id: string): boolean {
  return validator.isUUID(id, '4')
}

export function isValidDate(date: string): boolean {
  return validator.isDate(date, { format: 'YYYY-MM-DD', strictMode: true })
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time)
}

export function isValidURL(url: string): boolean {
  return validator.isURL(url, {
    protocols:              ['https'],
    require_protocol:       true,
    require_valid_protocol: true,
  })
}

// ── Object Sanitization ────────────────────────────────────────────────────────

/**
 * Deep-sanitize all string values in an object.
 * Prevents XSS in any field that gets stored.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value)
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? sanitizeText(v) : v)
    } else {
      result[key] = value
    }
  }

  return result as T
}

// ── SQL Injection Prevention Note ─────────────────────────────────────────────
// Supabase client uses parameterized queries — SQL injection is prevented
// at the driver level. Never use raw string interpolation in queries.
// These sanitizers handle XSS and business-level validation only.
