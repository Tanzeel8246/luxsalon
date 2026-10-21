/**
 * Business Service — Covers missing business workflows:
 *  - End-of-day reconciliation
 *  - Customer merge
 *  - Cancellation policy + fees
 *  - Tips management
 *  - Intake forms + allergy tracking
 *  - Before/After photos
 *  - Deposits
 *  - Recurring billing
 */

import { getSupabaseClient }         from '@/lib/supabase'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { format }                    from 'date-fns'
import { generateInvoicePDF }        from '@/lib/pdf'
import { logger }                    from '@/lib/logger'
import { sanitizeText, isValidUUID } from '@/lib/sanitize'
import type { ApiResponse }          from '@/types'

// ── END-OF-DAY RECONCILIATION ─────────────────────────────────────────────────

export const dayEndService = {
  async generateReport(branchId: string, date?: string): Promise<ApiResponse<Record<string, unknown>>> {
    if (!isValidUUID(branchId)) return { data: null, error: 'Invalid branch ID' }

    const supabase   = createAdminSupabaseClient() as any
    const reportDate = date ?? format(new Date(), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .rpc('fn_generate_day_end_report', {
        p_branch_id: branchId,
        p_date:      reportDate,
      })

    if (error) {
      logger.error('Day-end report generation failed', { branchId, error })
      return { data: null, error: error.message }
    }

    logger.info('Day-end report generated', { branchId, date: reportDate })
    return { data, error: null }
  },

  async closeDay(
    branchId:    string,
    closedBy:    string,
    cashActual:  number,
    notes?:      string
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const supabase   = createAdminSupabaseClient() as any
    const reportDate = format(new Date(), 'yyyy-MM-dd')

    // Generate report first
    await this.generateReport(branchId, reportDate)

    const { data, error } = await supabase
      .from('day_end_reports')
      .update({
        status:      'closed',
        cash_actual: cashActual,
        closed_by:   closedBy,
        closed_at:   new Date().toISOString(),
        notes:       notes ? sanitizeText(notes) : null,
      })
      .eq('branch_id', branchId)
      .eq('report_date', reportDate)
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }

    logger.info('Day closed', { branchId, closedBy, cashActual, date: reportDate })
    return { data, error: null }
  },

  async getDayReport(branchId: string, date: string): Promise<ApiResponse<Record<string, unknown>>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('day_end_reports')
      .select('*')
      .eq('branch_id', branchId)
      .eq('report_date', date)
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getReportHistory(branchId: string, limit = 30): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('day_end_reports')
      .select('*')
      .eq('branch_id', branchId)
      .order('report_date', { ascending: false })
      .limit(limit)

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },
}

// ── CUSTOMER MERGE ────────────────────────────────────────────────────────────

export const customerMergeService = {
  /**
   * Find potential duplicate customers by phone or email.
   */
  async findDuplicates(
    query: string
  ): Promise<ApiResponse<Array<{ customer: unknown; match_score: number; reason: string }>>> {
    const supabase = getSupabaseClient() as any

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`email.ilike.%${query}%,phone.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(20)

    if (error) return { data: null, error: error.message }

    const results = (data ?? []).map((c: any) => ({
      customer:    c,
      match_score: c.email.toLowerCase().includes(query.toLowerCase()) ? 90 :
                   c.phone?.includes(query) ? 85 : 60,
      reason: c.email.toLowerCase().includes(query.toLowerCase()) ? 'email match' :
              c.phone?.includes(query) ? 'phone match' : 'name match',
    })).sort((a: any, b: any) => b.match_score - a.match_score)

    return { data: results, error: null }
  },

  /**
   * Merge two customer records.
   * primaryId: the one to keep
   * mergedId:  the one to delete (after moving all data)
   */
  async mergeCustomers(
    primaryId:  string,
    mergedId:   string,
    mergedBy:   string
  ): Promise<ApiResponse<{ moved_appointments: number; moved_loyalty: number }>> {
    if (primaryId === mergedId) return { data: null, error: 'Cannot merge a customer with themselves' }
    if (!isValidUUID(primaryId) || !isValidUUID(mergedId)) return { data: null, error: 'Invalid IDs' }

    const supabase = createAdminSupabaseClient() as any

    // Verify both customers exist
    const [{ data: primary }, { data: merged }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', primaryId).single() as any,
      supabase.from('customers').select('*').eq('id', mergedId).single() as any,
    ])

    if (!primary) return { data: null, error: 'Primary customer not found' }
    if (!merged)  return { data: null, error: 'Customer to merge not found' }

    // Move all appointments
    const { count: apptCount } = await supabase
      .from('appointments')
      .update({ customer_id: primaryId })
      .eq('customer_id', mergedId)
      .select('*', { count: 'exact', head: true })

    // Move loyalty transactions
    const { count: loyaltyCount } = await supabase
      .from('loyalty_transactions')
      .update({ customer_id: primaryId })
      .eq('customer_id', mergedId)
      .select('*', { count: 'exact', head: true })

    // Combine loyalty points
    await supabase
      .from('customers')
      .update({ loyalty_points: primary.loyalty_points + merged.loyalty_points })
      .eq('id', primaryId)

    // Move queue entries
    await supabase.from('queue').update({ customer_id: primaryId }).eq('customer_id', mergedId)

    // Move notifications
    await supabase.from('notification_logs').update({ customer_id: primaryId }).eq('customer_id', mergedId)

    // Move POS transactions
    await supabase.from('pos_transactions').update({ customer_id: primaryId }).eq('customer_id', mergedId)

    // Log the merge
    await supabase.from('customer_merges').insert({
      primary_id:   primaryId,
      merged_id:    mergedId,
      merged_by:    mergedBy,
      merge_summary: {
        merged_name:        merged.name,
        merged_email:       merged.email,
        appointments_moved: apptCount ?? 0,
        loyalty_moved:      loyaltyCount ?? 0,
        loyalty_combined:   primary.loyalty_points + merged.loyalty_points,
      },
    })

    // Delete the merged customer
    await supabase.from('customers').delete().eq('id', mergedId)

    logger.info('Customers merged', { primaryId, mergedId, mergedBy })

    return {
      data: {
        moved_appointments: apptCount ?? 0,
        moved_loyalty:      loyaltyCount ?? 0,
      },
      error: null,
    }
  },
}

// ── CANCELLATION POLICY ───────────────────────────────────────────────────────

export const cancellationService = {
  async calculateFee(appointmentId: string): Promise<ApiResponse<{
    fee:    number
    reason: string
    policy: string
    waivable: boolean
  }>> {
    const supabase = createAdminSupabaseClient() as any

    const { data, error } = await supabase
      .rpc('fn_calculate_cancellation_fee', { p_appointment_id: appointmentId })

    if (error) return { data: null, error: error.message }

    const row = data?.[0]
    return {
      data: {
        fee:      row?.fee_amount ?? 0,
        reason:   row?.reason ?? 'early_cancel',
        policy:   row?.policy_name ?? 'none',
        waivable: true,   // Admins can always waive
      },
      error: null,
    }
  },

  async chargeCancellationFee(
    appointmentId: string,
    staffId:       string
  ): Promise<ApiResponse<unknown>> {
    const { data: feeData, error } = await this.calculateFee(appointmentId)
    if (error || !feeData) return { data: null, error: error ?? 'Fee calculation failed' }

    if (feeData.fee === 0) return { data: { fee: 0, reason: 'free_cancellation' }, error: null }

    const supabase = createAdminSupabaseClient() as any

    // Get appointment details to charge customer
    const { data: appt } = await supabase
      .from('appointments')
      .select('customer_id, total_price, staff_id')
      .eq('id', appointmentId)
      .single() as any

    if (!appt) return { data: null, error: 'Appointment not found' }

    const { data: fee, error: feeErr } = await supabase
      .from('cancellation_fees')
      .insert({
        appointment_id: appointmentId,
        customer_id:    appt.customer_id,
        fee_amount:     feeData.fee,
        reason:         feeData.reason,
        charged_at:     new Date().toISOString(),
      })
      .select().single() as any

    if (feeErr) return { data: null, error: feeErr.message }

    logger.info('Cancellation fee charged', { appointmentId, fee: feeData.fee, reason: feeData.reason })
    return { data: fee, error: null }
  },

  async waiveFee(feeId: string, waivedBy: string, reason: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient() as any
    const { error } = await supabase
      .from('cancellation_fees')
      .update({ waived: true, waived_by: waivedBy, waived_reason: sanitizeText(reason) })
      .eq('id', feeId)

    if (error) return { data: null, error: error.message }
    return { data: undefined, error: null }
  },
}

// ── TIPS MANAGEMENT ───────────────────────────────────────────────────────────

export const tipsService = {
  async recordTip(params: {
    appointment_id: string
    staff_id:       string
    customer_id?:   string
    amount:         number
    method:         'cash' | 'card' | 'wallet' | 'included'
    transaction_id?: string
  }): Promise<ApiResponse<unknown>> {
    if (params.amount <= 0) return { data: null, error: 'Tip amount must be positive' }

    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('tips')
      .upsert({
        appointment_id: params.appointment_id,
        staff_id:       params.staff_id,
        customer_id:    params.customer_id ?? null,
        transaction_id: params.transaction_id ?? null,
        amount:         params.amount,
        method:         params.method,
      }, { onConflict: 'appointment_id,staff_id' })
      .select().single() as any

    if (error) return { data: null, error: error.message }

    logger.info('Tip recorded', { staffId: params.staff_id, amount: params.amount })
    return { data, error: null }
  },

  async getStaffTips(
    staffId:     string,
    periodStart: string,
    periodEnd:   string
  ): Promise<ApiResponse<{ total: number; tips: unknown[] }>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('tips')
      .select('*, appointment(*)')
      .eq('staff_id', staffId)
      .gte('declared_at', `${periodStart}T00:00:00`)
      .lte('declared_at', `${periodEnd}T23:59:59`)
      .order('declared_at', { ascending: false })

    if (error) return { data: null, error: error.message }

    const total = (data ?? []).reduce((s: number, t: any) => s + t.amount, 0)
    return { data: { total: Math.round(total * 100) / 100, tips: data ?? [] }, error: null }
  },

  async markTipsPaidInPayroll(staffId: string, payrollId: string): Promise<ApiResponse<void>> {
    const supabase = createAdminSupabaseClient() as any
    await supabase
      .from('tips')
      .update({ included_in_payroll: true, paid_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .eq('included_in_payroll', false)

    return { data: undefined, error: null }
  },
}

// ── INTAKE FORMS ──────────────────────────────────────────────────────────────

export const intakeFormService = {
  async getForms(serviceId?: string): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient() as any
    let query = supabase.from('intake_forms').select('*').eq('is_active', true).order('name')
    if (serviceId) query = query.contains('service_ids', [serviceId])
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async submitForm(params: {
    form_id:        string
    customer_id:    string
    appointment_id: string
    responses:      Record<string, unknown>
  }): Promise<ApiResponse<unknown>> {
    // Sanitize all response values
    const cleanResponses: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params.responses)) {
      cleanResponses[key] = typeof value === 'string' ? sanitizeText(value) : value
    }

    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('intake_submissions')
      .upsert({
        form_id:        params.form_id,
        customer_id:    params.customer_id,
        appointment_id: params.appointment_id,
        responses:      cleanResponses,
        submitted_at:   new Date().toISOString(),
      }, { onConflict: 'form_id,appointment_id' })
      .select().single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getSubmission(appointmentId: string): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('intake_submissions')
      .select('*, form:intake_forms(*)')
      .eq('appointment_id', appointmentId)
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },
}

// ── HEALTH NOTES (Allergies) ──────────────────────────────────────────────────

export const healthNotesService = {
  async get(customerId: string): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('customer_health_notes')
      .select('*')
      .eq('customer_id', customerId)
      .single() as any

    if (error && error.code !== 'PGRST116') return { data: null, error: error.message }
    return { data: data ?? null, error: null }
  },

  async upsert(params: {
    customer_id:       string
    allergies?:        string[]
    sensitivities?:    string[]
    medical_notes?:    string
    preferred_products?: string[]
    avoided_products?: string[]
    updated_by:        string
  }): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('customer_health_notes')
      .upsert({
        customer_id:       params.customer_id,
        allergies:         params.allergies ?? [],
        sensitivities:     params.sensitivities ?? [],
        medical_notes:     params.medical_notes ? sanitizeText(params.medical_notes) : null,
        preferred_products: params.preferred_products ?? [],
        avoided_products:  params.avoided_products ?? [],
        updated_by:        params.updated_by,
        last_updated:      new Date().toISOString(),
      }, { onConflict: 'customer_id' })
      .select().single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },
}

// ── BEFORE/AFTER PHOTOS ───────────────────────────────────────────────────────

export const photoService = {
  async upload(params: {
    appointment_id: string
    customer_id:    string
    staff_id:       string
    photo_type:     'before' | 'after' | 'during'
    file:           Buffer
    mimeType:       string
    consent_given:  boolean
  }): Promise<ApiResponse<{ url: string; photo_id: string }>> {
    if (!params.consent_given) {
      return { data: null, error: 'Customer consent is required before taking photos' }
    }

    const supabase   = createAdminSupabaseClient() as any
    const ext        = params.mimeType.split('/')[1] ?? 'jpg'
    const path       = `photos/${params.appointment_id}/${params.photo_type}_${Date.now()}.${ext}`
    const bucket     = process.env.SUPABASE_STORAGE_BUCKET ?? 'luxsalon-assets'

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, params.file, { contentType: params.mimeType, cacheControl: '31536000' })

    if (upErr) return { data: null, error: upErr.message }

    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 86400 * 30)

    const { data: photo, error: dbErr } = await supabase
      .from('service_photos')
      .insert({
        appointment_id: params.appointment_id,
        customer_id:    params.customer_id,
        staff_id:       params.staff_id,
        photo_type:     params.photo_type,
        storage_path:   path,
        storage_url:    signedData?.signedUrl,
        consent_given:  params.consent_given,
      })
      .select().single() as any

    if (dbErr) return { data: null, error: dbErr.message }

    return { data: { url: signedData?.signedUrl ?? '', photo_id: photo.id }, error: null }
  },

  async getAppointmentPhotos(appointmentId: string): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('service_photos')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('taken_at')

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async getCustomerHistory(customerId: string): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('service_photos')
      .select('*, appointment:appointments(start_time, service:services(name))')
      .eq('customer_id', customerId)
      .order('taken_at', { ascending: false })
      .limit(50)

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },
}

// ── DEPOSITS ──────────────────────────────────────────────────────────────────

export const depositService = {
  async createDeposit(params: {
    appointment_id: string
    amount:         number
    currency:       string
    customer_email?: string
  }): Promise<ApiResponse<{ client_secret: string; deposit_id: string }>> {
    const { createPaymentIntent } = await import('@/lib/stripe')

    const intent = await createPaymentIntent({
      amount:       params.amount,
      currency:     params.currency,
      description:  'Appointment deposit',
      receiptEmail: params.customer_email,
      metadata:     { appointment_id: params.appointment_id, type: 'deposit' },
      captureMethod: 'automatic',
    })

    const supabase = getSupabaseClient() as any
    const { data, error } = await supabase
      .from('appointment_deposits')
      .insert({
        appointment_id:           params.appointment_id,
        amount:                   params.amount,
        currency:                 params.currency,
        stripe_payment_intent_id: intent.paymentIntentId,
        status:                   'pending',
      })
      .select().single() as any

    if (error) return { data: null, error: error.message }
    return { data: { client_secret: intent.clientSecret, deposit_id: data.id }, error: null }
  },

  async confirmDeposit(depositId: string): Promise<ApiResponse<void>> {
    const supabase = createAdminSupabaseClient() as any
    await supabase
      .from('appointment_deposits')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', depositId)

    return { data: undefined, error: null }
  },
}
