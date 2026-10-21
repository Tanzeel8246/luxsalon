/**
 * Input Sanitization Tests
 * Verifies XSS and injection prevention.
 */

import {
  sanitizeText,
  sanitizeRichText,
  sanitizeObject,
  isValidEmail,
  isValidPhone,
  isValidUUID,
  isValidDate,
  isValidTime,
} from '@/lib/sanitize'

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('Hello')
    expect(sanitizeText('<b>Bold</b> text')).toBe('Bold text')
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('')
  })

  it('handles non-string input', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
    expect(sanitizeText(123)).toBe('')
  })

  it('preserves safe text', () => {
    expect(sanitizeText('Hello, World!')).toBe('Hello, World!')
    expect(sanitizeText('  trimmed  ')).toBe('trimmed')
    expect(sanitizeText('50% off today!')).toBe('50% off today!')
  })

  it('handles emoji', () => {
    expect(sanitizeText('Great service! 😊')).toBe('Great service! 😊')
  })
})

describe('sanitizeRichText', () => {
  it('allows basic formatting tags', () => {
    expect(sanitizeRichText('<b>Bold</b>')).toBe('<b>Bold</b>')
    expect(sanitizeRichText('<em>Italic</em>')).toBe('<em>Italic</em>')
  })

  it('strips dangerous tags', () => {
    expect(sanitizeRichText('<script>alert(1)</script>')).toBe('')
    expect(sanitizeRichText('<a href="javascript:void">Link</a>')).not.toContain('javascript')
  })
})

describe('sanitizeObject', () => {
  it('sanitizes all string values recursively', () => {
    const result = sanitizeObject({
      name:  '<b>John</b>',
      notes: '<script>xss</script>Hello',
      phone: '03001234567',
      nested: { label: '<em>test</em>' },
    })

    expect(result.name).toBe('John')
    expect(result.notes).toBe('Hello')
    expect(result.phone).toBe('03001234567')
    expect(result.nested.label).toBe('test')
  })
})

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('validates emails correctly', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('validates phone numbers', () => {
      expect(isValidPhone('+923001234567')).toBe(true)
      expect(isValidPhone('03001234567')).toBe(true)
      expect(isValidPhone('notaphone')).toBe(false)
    })
  })

  describe('isValidUUID', () => {
    it('validates UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('')).toBe(false)
    })
  })

  describe('isValidDate', () => {
    it('validates dates in YYYY-MM-DD format', () => {
      expect(isValidDate('2026-06-06')).toBe(true)
      expect(isValidDate('2026-13-01')).toBe(false)     // Invalid month
      expect(isValidDate('06/06/2026')).toBe(false)     // Wrong format
      expect(isValidDate('')).toBe(false)
    })
  })

  describe('isValidTime', () => {
    it('validates HH:MM 24h format', () => {
      expect(isValidTime('09:00')).toBe(true)
      expect(isValidTime('23:59')).toBe(true)
      expect(isValidTime('24:00')).toBe(false)
      expect(isValidTime('9:00')).toBe(false)    // Must be 2-digit
      expect(isValidTime('09:60')).toBe(false)
    })
  })
})
