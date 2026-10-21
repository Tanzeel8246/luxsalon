/**
 * Walk-in Customer API
 * Handles customers who arrive without a prior appointment.
 *
 * Flow:
 *  1. Receptionist creates a walk-in record
 *  2. System creates a guest customer profile (or links existing by phone)
 *  3. System adds customer to queue automatically
 *  4. POS transaction is created when service is complete
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { applyRateLimit }             from '@/lib/ratelimit'
import { sanitizeText, isValidPhone, isValidUUID } from '@/lib/sanitize'
import { logger }                     from '@/lib/logger'
import { z }                          from 'zod'

const walkInSchema = z.object({
  name:       z.string().min(2).max(100),
  phone:      z.string().optional(),
  service_id: z.string().uuid(),
  staff_id:   z.string().uuid().optional(),
  branch_id:  z.string().uuid(),
  notes:      z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  // Rate limit — staff endpoint
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase  = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify staff role
  const { data: staffMember } = await supabase
    .from('staff').select('id, role').eq('user_id', session.user.id).single() as any

  if (!staffMember) {
    return NextResponse.json({ error: 'Access denied — staff only' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = walkInSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, phone, service_id, staff_id, branch_id, notes } = parsed.data

  // Sanitize inputs
  const cleanName  = sanitizeText(name)
  const cleanPhone = phone ? phone.replace(/\D/g, '') : null
  const cleanNotes = notes ? sanitizeText(notes) : null

  // Phone validation
  if (cleanPhone && !isValidPhone(cleanPhone)) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
  }

  // ── Find existing customer by phone, or create walk-in profile ───────────

  let customerId: string

  if (cleanPhone) {
    const { data: existing } = await supabase
      .from('customers').select('id').eq('phone', cleanPhone).single() as any

    if (existing) {
      customerId = existing.id
      logger.info('Walk-in matched existing customer', { customerId, phone: cleanPhone })
    } else {
      // Create guest profile
      const { data: newCustomer, error: custErr } = await (supabase as any)
        .from('customers')
        .insert({
          name:  cleanName,
          phone: cleanPhone,
          email: `walkin_${Date.now()}@guest.luxsalon.local`,   // Placeholder — no email
          tier:  'bronze',
          preferences: { is_walk_in: true },
        })
        .select().single() as any

      if (custErr || !newCustomer) {
        logger.error('Walk-in customer creation failed', { error: custErr })
        return NextResponse.json({ error: 'Customer creation failed' }, { status: 500 })
      }
      customerId = newCustomer.id
      logger.info('Walk-in new customer created', { customerId, name: cleanName })
    }
  } else {
    // Anonymous walk-in — create minimal profile
    const { data: anon, error: anonErr } = await (supabase as any)
      .from('customers')
      .insert({
        name:  cleanName,
        email: `anon_${Date.now()}@walkin.luxsalon.local`,
        tier:  'bronze',
        preferences: { is_walk_in: true, is_anonymous: true },
      })
      .select().single() as any

    if (anonErr || !anon) {
      return NextResponse.json({ error: 'Failed to create walk-in record' }, { status: 500 })
    }
    customerId = anon.id
  }

  // ── Add to queue ──────────────────────────────────────────────────────────

  const { data: queueResult, error: queueErr } = await (supabase as any)
    .rpc('fn_add_to_queue_safe', {
      p_customer_id: customerId,
      p_service_id:  service_id,
      p_staff_id:    staff_id ?? null,
      p_branch_id:   branch_id,
    })

  const queueRow = queueResult?.[0]

  if (queueErr || !queueRow?.success) {
    return NextResponse.json({
      error: queueRow?.error_message ?? queueErr?.message ?? 'Queue error',
    }, { status: 500 })
  }

  // ── Create appointment record (walk-in type) ──────────────────────────────

  const { data: service } = await supabase
    .from('services').select('duration, base_price').eq('id', service_id).single() as any

  const startTime = new Date()
  const endTime   = new Date(startTime.getTime() + (service?.duration ?? 30) * 60000)

  const { data: appointment } = await (supabase as any)
    .from('appointments')
    .insert({
      customer_id:   customerId,
      staff_id:      staff_id ?? null,
      service_id,
      branch_id,
      start_time:    startTime.toISOString(),
      end_time:      endTime.toISOString(),
      status:        'confirmed',
      total_price:   service?.base_price ?? 0,
      notes:         cleanNotes,
    })
    .select()
    .single() as any

  logger.info('Walk-in processed', {
    customerId,
    queuePosition: queueRow.position,
    estimatedWait: queueRow.estimated_wait,
    appointmentId: appointment?.id,
  })

  return NextResponse.json({
    data: {
      customer_id:    customerId,
      appointment_id: appointment?.id,
      queue_id:       queueRow.queue_id,
      queue_position: queueRow.position,
      estimated_wait: queueRow.estimated_wait,
      message:        `${cleanName} added to queue. Position #${queueRow.position}. Estimated wait: ${queueRow.estimated_wait} minutes.`,
    },
  }, { status: 201 })
}
