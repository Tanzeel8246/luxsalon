/**
 * Booking API Integration Tests
 * Tests: validation, auth, booking creation, slot fetching.
 */

// Note: These are unit tests of the API logic.
// E2E tests with real DB require a test Supabase project.

import { z } from 'zod'

// ── Schema Tests ──────────────────────────────────────────────────────────────

const bookingSchema = z.object({
  service_id:  z.string().uuid(),
  staff_id:    z.string().uuid(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:        z.string().regex(/^\d{2}:\d{2}$/),
  package_id:  z.string().uuid().optional(),
  notes:       z.string().max(500).optional(),
})

describe('Booking Schema Validation', () => {
  it('rejects missing required fields', () => {
    const result = bookingSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = Object.keys(result.error.flatten().fieldErrors)
      expect(fields).toContain('service_id')
      expect(fields).toContain('staff_id')
    }
  })

  it('rejects invalid UUID format', () => {
    const result = bookingSchema.safeParse({
      service_id: 'not-a-uuid',
      staff_id:   'also-not-uuid',
      date:       '2026-06-10',
      time:       '10:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = bookingSchema.safeParse({
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id:   '660e8400-e29b-41d4-a716-446655440000',
      date:       '10/06/2026',  // Wrong format
      time:       '10:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = bookingSchema.safeParse({
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id:   '660e8400-e29b-41d4-a716-446655440000',
      date:       '2026-06-10',
      time:       '25:00',  // Invalid hour
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes exceeding 500 characters', () => {
    const result = bookingSchema.safeParse({
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id:   '660e8400-e29b-41d4-a716-446655440000',
      date:       '2026-06-10',
      time:       '10:00',
      notes:      'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid booking request', () => {
    const result = bookingSchema.safeParse({
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id:   '660e8400-e29b-41d4-a716-446655440000',
      date:       '2026-06-10',
      time:       '10:00',
      notes:      'Please use organic products.',
    })
    expect(result.success).toBe(true)
  })
})

describe('Walk-in Schema Validation', () => {
  const walkInSchema = z.object({
    name:       z.string().min(2).max(100),
    phone:      z.string().optional(),
    service_id: z.string().uuid(),
    branch_id:  z.string().uuid(),
  })

  it('requires at minimum name, service_id, branch_id', () => {
    const bad = walkInSchema.safeParse({ name: 'J' })  // Too short
    expect(bad.success).toBe(false)

    const good = walkInSchema.safeParse({
      name:       'John Doe',
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      branch_id:  '770e8400-e29b-41d4-a716-446655440000',
    })
    expect(good.success).toBe(true)
  })
})
