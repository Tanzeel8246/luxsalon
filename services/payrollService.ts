/**
 * Payroll Service v2 — Per-staff configurable commission rules.
 *
 * CRITICAL FIX: Replaced hardcoded 35% with fn_resolve_commission()
 * CRITICAL FIX: Fixed broken `supabase.rpc as never` code
 * ADDED: Staff salary configuration
 * ADDED: Deductions and bonuses
 * ADDED: Tiered commission support
 * ADDED: Proper period-based calculation
 */

import { getSupabaseClient }    from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { logger }               from '@/lib/logger'
import { isValidUUID }          from '@/lib/sanitize'
import type { StaffPayroll, ApiResponse } from '@/types'

export const payrollService = {

  /**
   * Calculate payroll for one staff member for a given period.
   * Uses fn_resolve_commission() for configurable commission rules.
   */
  async calculatePayroll(
    staffId:     string,
    periodStart: string,
    periodEnd:   string
  ): Promise<ApiResponse<StaffPayroll>> {
    if (!isValidUUID(staffId)) return { data: null, error: 'Invalid staff ID' }

    const supabase = getSupabaseClient()

    // ── Get base salary ────────────────────────────────────────
    const { data: salaryConfig } = await supabase
      .from('staff_salary_config')
      .select('base_salary, pay_period, currency')
      .eq('staff_id', staffId)
      .single() as any

    const baseSalary = salaryConfig?.base_salary ?? 0

    // ── Get completed appointments for the period ──────────────
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, service_id, total_price, status')
      .eq('staff_id', staffId)
      .eq('status', 'completed')
      .gte('start_time', `${periodStart}T00:00:00`)
      .lte('start_time', `${periodEnd}T23:59:59`)

    const appts = appointments ?? []

    // ── Calculate commission per appointment using DB function ──
    let commissionEarned = 0
    for (const appt of appts) {
      const { data: commResult } = await supabase
        .rpc('fn_resolve_commission', {
          p_staff_id:     staffId,
          p_service_id:   appt.service_id,
          p_revenue:      appt.total_price,
          p_period_start: periodStart,
          p_period_end:   periodEnd,
        })

      commissionEarned += (commResult as number) ?? 0
    }

    commissionEarned = Math.round(commissionEarned * 100) / 100

    // ── Get tips from POS transactions ─────────────────────────
    const { data: tipData } = await supabase
      .from('pos_transactions')
      .select('tip_amount')
      .eq('cashier_id', staffId)
      .eq('status', 'completed')
      .gte('created_at', `${periodStart}T00:00:00`)
      .lte('created_at', `${periodEnd}T23:59:59`)

    const tipsEarned = Math.round(
      (tipData ?? []).reduce((s, t) => s + t.tip_amount, 0) * 100
    ) / 100

    // ── Get retail commission ──────────────────────────────────
    const { data: retailData } = await supabase
      .from('retail_sales')
      .select('total, commission_pct')
      .eq('staff_id', staffId)
      .gte('created_at', `${periodStart}T00:00:00`)
      .lte('created_at', `${periodEnd}T23:59:59`)

    const retailCommission = Math.round(
      (retailData ?? []).reduce((s, r) => s + r.total * (r.commission_pct / 100), 0) * 100
    ) / 100

    // ── Get scheduled deductions/bonuses ───────────────────────
    const { data: adjustments } = await supabase
      .from('payroll_deductions')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_recurring', true)
      .or(`frequency.eq.monthly,and(start_date.lte.${periodEnd},end_date.gte.${periodStart})`)

    let bonuses    = 0
    let deductions = 0

    for (const adj of (adjustments ?? [])) {
      if (adj.type === 'bonus') bonuses    += adj.amount
      else                      deductions += adj.amount
    }

    // One-time adjustments for this period
    const { data: oneTime } = await supabase
      .from('payroll_deductions')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_recurring', false)
      .eq('frequency', 'once')
      .gte('start_date', periodStart)
      .lte('start_date', periodEnd)

    for (const adj of (oneTime ?? [])) {
      if (adj.type === 'bonus') bonuses    += adj.amount
      else                      deductions += adj.amount
    }

    // ── Calculate totals ───────────────────────────────────────
    const totalCommission = commissionEarned + retailCommission
    const gross           = baseSalary + totalCommission + tipsEarned + bonuses - deductions
    const grossRounded    = Math.round(gross * 100) / 100

    // Tax calculation (configurable — using default 20% for demo)
    // In production: integrate with regional tax tables
    const taxRate    = 0.20
    const taxAmount  = Math.round(grossRounded * taxRate * 100) / 100
    const netPay     = Math.round((grossRounded - taxAmount) * 100) / 100

    // ── Save payroll record ────────────────────────────────────
    const { data, error } = await supabase
      .from('staff_payroll')
      .insert({
        staff_id:          staffId,
        period_start:      periodStart,
        period_end:        periodEnd,
        base_salary:       baseSalary,
        commission_rate:   0,   // Dynamic per rule — stored as 0
        commission_earned: totalCommission,
        tips_earned:       tipsEarned,
        bonuses:           Math.round(bonuses * 100) / 100,
        deductions:        Math.round(deductions * 100) / 100,
        gross_total:       grossRounded,
        tax_deducted:      taxAmount,
        net_pay:           netPay,
        status:            'pending',
        notes:             `${appts.length} appointments · ${retailData?.length ?? 0} retail sales`,
      })
      .select('*, staff(*)')
      .single() as any

    if (error) {
      logger.error('Payroll calculation error', { staffId, error })
      return { data: null, error: error.message }
    }

    logger.info('Payroll calculated', {
      staffId,
      period:   `${periodStart} → ${periodEnd}`,
      gross:    grossRounded,
      netPay,
      appointments: appts.length,
    })

    return { data, error: null }
  },

  /**
   * Process payroll for all active staff in a period.
   * Skips staff if payroll already exists for this period.
   */
  async processMonthlyPayroll(year: number, month: number): Promise<ApiResponse<StaffPayroll[]>> {
    const supabase = getSupabaseClient()
    const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
    const end   = format(endOfMonth(new Date(year, month - 1)),   'yyyy-MM-dd')

    const { data: staff } = await supabase
      .from('staff').select('id, name').eq('is_active', true)
    if (!staff) return { data: [], error: null }

    const results: StaffPayroll[] = []
    const errors: string[] = []

    for (const s of staff) {
      // Skip if already processed for this period
      const { data: existing } = await supabase
        .from('staff_payroll')
        .select('id')
        .eq('staff_id', s.id)
        .eq('period_start', start)
        .single() as any

      if (existing) {
        logger.info('Skipping already-processed payroll', { staffId: s.id, period: start })
        continue
      }

      const { data, error } = await this.calculatePayroll(s.id, start, end)
      if (data) results.push(data)
      if (error) errors.push(`${s.name}: ${error}`)
    }

    if (errors.length > 0) {
      logger.warn('Payroll processing had errors', { errors })
    }

    return { data: results, error: errors.length > 0 ? errors.join('; ') : null }
  },

  async approvePayroll(payrollId: string, approvedBy: string): Promise<ApiResponse<StaffPayroll>> {
    if (!isValidUUID(payrollId)) return { data: null, error: 'Invalid payroll ID' }

    const supabase = getSupabaseClient()
    const { data: current } = await supabase
      .from('staff_payroll').select('status').eq('id', payrollId).single() as any

    if (current?.status !== 'pending') {
      return { data: null, error: `Cannot approve payroll in status: ${current?.status}` }
    }

    const { data, error } = await supabase
      .from('staff_payroll')
      .update({ status: 'approved', notes: `Approved by ${approvedBy}` })
      .eq('id', payrollId)
      .select('*, staff(*)')
      .single() as any

    if (error) return { data: null, error: error.message }
    logger.info('Payroll approved', { payrollId, approvedBy })
    return { data, error: null }
  },

  async markPaid(payrollId: string, paymentRef?: string): Promise<ApiResponse<StaffPayroll>> {
    const supabase = getSupabaseClient()
    const { data: current } = await supabase
      .from('staff_payroll').select('status').eq('id', payrollId).single() as any

    if (current?.status !== 'approved') {
      return { data: null, error: 'Payroll must be approved before marking as paid' }
    }

    const { data, error } = await supabase
      .from('staff_payroll')
      .update({
        status:  'paid',
        paid_at: new Date().toISOString(),
        notes:   paymentRef ? `Payment ref: ${paymentRef}` : undefined,
      })
      .eq('id', payrollId)
      .select('*, staff(*)')
      .single() as any

    if (error) return { data: null, error: error.message }
    logger.info('Payroll marked paid', { payrollId, paymentRef })
    return { data, error: null }
  },

  async getPayrollHistory(
    staffId?: string,
    status?:  StaffPayroll['status'],
    page      = 1,
    perPage   = 20
  ): Promise<ApiResponse<{ payrolls: StaffPayroll[]; total: number }>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('staff_payroll')
      .select('*, staff(*)', { count: 'exact' })
      .order('period_start', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (staffId) query = query.eq('staff_id', staffId)
    if (status)  query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) return { data: null, error: error.message }
    return { data: { payrolls: data ?? [], total: count ?? 0 }, error: null }
  },

  // ── Commission Rules ───────────────────────────────────────────────────────

  async setCommissionRule(rule: {
    staff_id?:     string
    service_id?:   string
    category?:     string
    rule_type:     'percentage' | 'fixed' | 'tiered'
    rate?:         number
    fixed_amount?: number
    tiers?:        Array<{ min_revenue: number; rate: number }>
    priority?:     number
    notes?:        string
  }): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('commission_rules')
      .insert({
        ...rule,
        tiers:     rule.tiers ? JSON.stringify(rule.tiers) : null,
        is_active: true,
      })
      .select().single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getCommissionRules(staffId?: string): Promise<ApiResponse<unknown[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('commission_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (staffId) query = query.or(`staff_id.eq.${staffId},staff_id.is.null`)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async setSalaryConfig(staffId: string, params: {
    base_salary:    number
    pay_period?:    'weekly' | 'biweekly' | 'monthly'
    currency?:      string
    effective_from?: string
  }): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('staff_salary_config')
      .upsert({
        staff_id:       staffId,
        base_salary:    params.base_salary,
        pay_period:     params.pay_period ?? 'monthly',
        currency:       params.currency ?? process.env.DEFAULT_CURRENCY ?? 'PKR',
        effective_from: params.effective_from ?? format(new Date(), 'yyyy-MM-dd'),
      }, { onConflict: 'staff_id' })

    if (error) return { data: null, error: error.message }
    return { data: undefined, error: null }
  },

  // ── Expenses ────────────────────────────────────────────────────────────────

  async addExpense(expense: {
    category:    string
    description: string
    amount:      number
    date?:       string
    branch_id?:  string
    approved_by?: string
    receipt_url?: string
  }): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...expense,
        date: expense.date ?? format(new Date(), 'yyyy-MM-dd'),
      })
      .select().single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getExpenses(
    branchId?: string,
    month?:    string,
    page       = 1,
    perPage    = 50
  ): Promise<ApiResponse<{ expenses: unknown[]; total_amount: number }>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('expenses').select('*')
      .order('date', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (branchId) query = query.eq('branch_id', branchId)
    if (month) {
      const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd')
      query = query.gte('date', `${month}-01`).lte('date', end)
    }

    const { data, error } = await query
    if (error) return { data: null, error: error.message }

    const totalAmount = (data ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
    return { data: { expenses: data ?? [], total_amount: totalAmount }, error: null }
  },
}
