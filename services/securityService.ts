/**
 * Security Service v2 — Real TOTP implementation.
 *
 * CRITICAL FIX: Replaced fake validateTOTP() that accepted any 6-digit number.
 * Now uses otplib with AES-256-GCM encrypted secrets.
 */
import { getSupabaseClient } from '@/lib/supabase'
import {
  generateTOTPSetup,
  hashBackupCodes,
  verifyTOTPToken,
  verifyBackupCode,
  removeBackupCode,
  regenerateBackupCodes,
  encryptSecret,
  isTOTPConfigured,
} from '@/lib/totp'
import { logger } from '@/lib/logger'
import { sanitizeText, isValidUUID } from '@/lib/sanitize'
import type { AuditLog, TwoFactorAuth, GDPRRequest, SuspiciousActivity, ApiResponse } from '@/types'

export const securityService = {
  // ── Audit Logs ───────────────────────────────────────────────
  async getAuditLogs(filters?: {
    resource?:  string
    severity?:  AuditLog['severity']
    user_id?:   string
    from_date?: string
    to_date?:   string
    limit?:     number
  }): Promise<ApiResponse<AuditLog[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 100)

    if (filters?.resource)  query = query.eq('resource', filters.resource)
    if (filters?.severity)  query = query.eq('severity', filters.severity)
    if (filters?.user_id)   query = query.eq('user_id', filters.user_id)
    if (filters?.from_date) query = query.gte('created_at', filters.from_date)
    if (filters?.to_date)   query = query.lte('created_at', filters.to_date)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async logAction(
    action:      string,
    resource:    string,
    resourceId:  string,
    oldData?:    Record<string, unknown>,
    newData?:    Record<string, unknown>,
    severity:    AuditLog['severity'] = 'info'
  ): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.from('audit_logs').insert({
      action, resource, resource_id: resourceId,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      severity,
    })
  },

  // ── 2FA — REAL TOTP (otplib + AES-256-GCM) ────────────────────
  async setup2FA(
    userId:    string,
    userEmail: string,
    method:    TwoFactorAuth['method'] = 'totp'
  ): Promise<ApiResponse<{
    qrCodeBase64: string
    backupCodes:  string[]   // Show once — user must save these
    otpauthUrl:   string
  }>> {
    if (!isTOTPConfigured()) {
      return { data: null, error: 'TOTP not configured on server. Set ENCRYPTION_KEY.' }
    }

    const supabase = getSupabaseClient()
    const setup    = await generateTOTPSetup(userEmail)

    // Hash backup codes for storage (never store plain)
    const hashedCodes = await hashBackupCodes(setup.backupCodes)

    const { error } = await supabase.from('two_factor_auth').upsert({
      user_id:      userId,
      method,
      secret:       setup.secret,               // AES-256-GCM encrypted
      backup_codes: JSON.stringify(hashedCodes), // bcrypt hashed JSON array
      is_enabled:   false,
    }, { onConflict: 'user_id' })

    if (error) {
      logger.error('2FA setup error', { userId, error })
      return { data: null, error: error.message }
    }

    logger.info('2FA setup initiated', { userId, method })

    return {
      data: {
        qrCodeBase64: setup.qrCodeBase64,
        backupCodes:  setup.backupCodes,   // Plain — show ONCE
        otpauthUrl:   setup.otpauthUrl,
      },
      error: null,
    }
  },

  async verify2FA(
    userId: string,
    code:   string
  ): Promise<ApiResponse<{ valid: boolean; usedBackup: boolean }>> {
    const supabase = getSupabaseClient()
    const { data: record } = await supabase
      .from('two_factor_auth').select('*').eq('user_id', userId).single() as any

    if (!record || !record.is_enabled) {
      return { data: null, error: '2FA is not enabled for this account' }
    }

    const cleanCode = code.replace(/\s/g, '').toUpperCase()

    // Try TOTP token first (6 digits)
    if (/^\d{6}$/.test(cleanCode)) {
      const isValid = verifyTOTPToken(record.secret, cleanCode)

      if (isValid) {
        await supabase.from('two_factor_auth')
          .update({ last_used: new Date().toISOString() })
          .eq('user_id', userId)

        logger.info('2FA verified via TOTP', { userId })
        return { data: { valid: true, usedBackup: false }, error: null }
      }
    }

    // Try backup code (8 alphanumeric chars)
    if (cleanCode.length === 8 || cleanCode.length === 9) {  // with optional hyphen
      const normalized = cleanCode.replace('-', '')
      const backup = await verifyBackupCode(normalized, record.backup_codes)

      if (backup.valid) {
        // Remove used backup code
        const updatedCodes = removeBackupCode(record.backup_codes, backup.matchIndex)
        await supabase.from('two_factor_auth').update({
          backup_codes: updatedCodes,
          last_used:    new Date().toISOString(),
        }).eq('user_id', userId)

        const remaining = JSON.parse(updatedCodes).length
        logger.warn('2FA backup code used', { userId, remaining })

        return { data: { valid: true, usedBackup: true }, error: null }
      }
    }

    logger.warn('2FA verification failed', { userId })
    return { data: { valid: false, usedBackup: false }, error: null }
  },

  async enable2FA(userId: string, verificationToken: string): Promise<ApiResponse<void>> {
    // Must verify one valid token before enabling
    const verifyResult = await this.verify2FA(userId, verificationToken)
    if (!verifyResult.data?.valid) {
      return { data: null, error: 'Token verification failed — cannot enable 2FA' }
    }

    const supabase = getSupabaseClient()
    await supabase.from('two_factor_auth').update({ is_enabled: true }).eq('user_id', userId)
    logger.info('2FA enabled', { userId })
    return { data: undefined, error: null }
  },

  async disable2FA(userId: string, verificationToken: string): Promise<ApiResponse<void>> {
    // Must verify current token before disabling
    const verifyResult = await this.verify2FA(userId, verificationToken)
    if (!verifyResult.data?.valid) {
      return { data: null, error: 'Token verification failed — cannot disable 2FA' }
    }

    const supabase = getSupabaseClient()
    await supabase.from('two_factor_auth').update({ is_enabled: false }).eq('user_id', userId)
    logger.warn('2FA disabled', { userId })
    return { data: undefined, error: null }
  },

  async regenerate2FABackupCodes(
    userId:            string,
    verificationToken: string
  ): Promise<ApiResponse<string[]>> {
    const verifyResult = await this.verify2FA(userId, verificationToken)
    if (!verifyResult.data?.valid) {
      return { data: null, error: 'Token verification required to regenerate codes' }
    }

    const { plain, hashed } = await regenerateBackupCodes()
    const supabase = getSupabaseClient()
    await supabase.from('two_factor_auth')
      .update({ backup_codes: JSON.stringify(hashed) })
      .eq('user_id', userId)

    logger.info('2FA backup codes regenerated', { userId })
    return { data: plain, error: null }    // Return plain once — user must save
  },

  // ── GDPR ────────────────────────────────────────────────────
  async submitGDPRRequest(
    customerId:  string,
    requestType: GDPRRequest['request_type'],
    notes?:      string
  ): Promise<ApiResponse<GDPRRequest>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('gdpr_requests')
      .insert({ customer_id: customerId, request_type: requestType, notes: notes ?? null })
      .select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async processGDPRRequest(requestId: string, processedBy: string, status: 'completed' | 'rejected'): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { data: req } = await supabase
      .from('gdpr_requests').select('*').eq('id', requestId).single() as any

    if (!req) return { data: null, error: 'Request not found' }

    if (status === 'completed' && req.request_type === 'delete') {
      await supabase.from('customers').delete().eq('id', req.customer_id)
    }

    await supabase.from('gdpr_requests').update({
      status, processed_by: processedBy, processed_at: new Date().toISOString(),
    }).eq('id', requestId)

    return { data: undefined, error: null }
  },

  async exportCustomerData(customerId: string): Promise<ApiResponse<Record<string, unknown>>> {
    const supabase = getSupabaseClient()

    const [
      { data: customer },
      { data: appointments },
      { data: loyalty },
      { data: notifications },
    ] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single() as any,
      supabase.from('appointments').select('*').eq('customer_id', customerId),
      supabase.from('loyalty_transactions').select('*').eq('customer_id', customerId),
      supabase.from('notification_logs').select('*').eq('customer_id', customerId),
    ])

    return {
      data: { customer, appointments, loyalty_transactions: loyalty, notification_history: notifications },
      error: null,
    }
  },

  async getGDPRRequests(): Promise<ApiResponse<GDPRRequest[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('gdpr_requests').select('*, customer(*)')
      .order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Suspicious Activity ──────────────────────────────────────
  async detectSuspiciousActivity(
    userId:   string | null,
    ip:       string,
    activity: string,
    details:  Record<string, unknown> = {}
  ): Promise<{ is_suspicious: boolean; risk_score: number }> {
    const supabase = getSupabaseClient()

    const { data: recentActivity } = await supabase
      .from('suspicious_activities')
      .select('risk_score')
      .eq('ip_address', ip)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())

    const recentCount = recentActivity?.length ?? 0
    const riskScore   = Math.min(1, recentCount * 0.2 + (activity.includes('failed') ? 0.3 : 0))

    if (riskScore > 0.3) {
      await supabase.from('suspicious_activities').insert({
        user_id: userId, ip_address: ip, activity, risk_score: riskScore,
        is_blocked: riskScore > 0.8, details,
      })
    }

    return { is_suspicious: riskScore > 0.5, risk_score: riskScore }
  },

  async getSuspiciousActivities(limit = 50): Promise<ApiResponse<SuspiciousActivity[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('suspicious_activities').select('*')
      .order('created_at', { ascending: false }).limit(limit)
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── IP Whitelist ─────────────────────────────────────────────
  async addToWhitelist(ip: string, label: string, addedBy: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('ip_whitelist').insert({ ip_address: ip, label, added_by: addedBy })
    if (error) return { data: null, error: error.message }
    return { data: undefined, error: null }
  },

  async isIPWhitelisted(ip: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('ip_whitelist').select('id').eq('ip_address', ip).eq('is_active', true).single() as any
    return !!data
  },
}

function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function validateTOTP(secret: string, token: string): boolean {
  // Simplified TOTP validation — in production use 'otplib' library
  return token.length === 6 && /^\d{6}$/.test(token)
}
