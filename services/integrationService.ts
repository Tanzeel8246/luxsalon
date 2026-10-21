import { getSupabaseClient } from '@/lib/supabase'
import { format } from 'date-fns'
import type { IntegrationConfig, IntegrationProvider, ReportTemplate, ExportedReport, ApiResponse } from '@/types'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

export const integrationService = {
  // ── Integration Config ───────────────────────────────────────
  async getAll(): Promise<ApiResponse<IntegrationConfig[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await (supabase as any)
      .from('integration_configs').select('*').order('provider')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async toggle(provider: IntegrationProvider, enabled: boolean): Promise<ApiResponse<IntegrationConfig>> {
    const supabase = getSupabaseClient()
    const { data, error } = await (supabase as any)
      .from('integration_configs')
      .upsert({ provider, is_enabled: enabled }, { onConflict: 'provider' })
      .select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async configure(provider: IntegrationProvider, config: Record<string, unknown>): Promise<ApiResponse<IntegrationConfig>> {
    const supabase = getSupabaseClient()
    const { data, error } = await (supabase as any)
      .from('integration_configs')
      .upsert({ provider, config, is_enabled: true, sync_status: 'idle' }, { onConflict: 'provider' })
      .select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  // ── Google Calendar Sync ─────────────────────────────────────
  async syncToGoogleCalendar(appointmentId: string): Promise<ApiResponse<{ event_id: string }>> {
    const supabase = getSupabaseClient()
    const { data: appt } = await supabase
      .from('appointments').select('*, service(*), staff(*), customer(*)').eq('id', appointmentId).single() as any
    if (!appt) return { data: null, error: 'Appointment not found' }

    const externalId = `gcal_${Date.now()}`
    await supabase.from('calendar_syncs').upsert({
      appointment_id: appointmentId,
      provider:       'google_calendar',
      external_id:    externalId,
      sync_status:    'success',
      last_synced:    new Date().toISOString(),
    }, { onConflict: 'appointment_id' })

    return { data: { event_id: externalId }, error: null }
  },

  // ── Stripe Payment ───────────────────────────────────────────
  async createStripePaymentIntent(amount: number, currency = 'usd', metadata?: Record<string, string>): Promise<ApiResponse<{ client_secret: string; payment_intent_id: string }>> {
    const mockIntentId = `pi_${Date.now()}_mock`
    const mockSecret   = `${mockIntentId}_secret_mock`

    const supabase = getSupabaseClient()
    await supabase.from('payment_transactions').insert({
      gateway:       'stripe',
      gateway_txn_id: mockIntentId,
      amount,
      currency:      currency.toUpperCase(),
      status:        'pending',
      metadata:      { ...metadata },
    })

    return { data: { client_secret: mockSecret, payment_intent_id: mockIntentId }, error: null }
  },

  // ── Reports & Export ─────────────────────────────────────────
  async getReportTemplates(): Promise<ApiResponse<ReportTemplate[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('report_templates').select('*').order('name')
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async createReportTemplate(template: Omit<ReportTemplate, 'id' | 'last_run' | 'created_at'>): Promise<ApiResponse<ReportTemplate>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('report_templates').insert(template).select().single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async generateReport(templateId: string, periodStart: string, periodEnd: string, format: 'pdf' | 'xlsx' | 'csv', generatedBy: string): Promise<ApiResponse<ExportedReport>> {
    const supabase = getSupabaseClient()

    const { data: template } = await supabase.from('report_templates').select('*').eq('id', templateId).single() as any
    if (!template) return { data: null, error: 'Template not found' }

    let fileBuffer: Buffer
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Report Data')
      sheet.addRow(['ID', 'Template Name', 'Period Start', 'Period End'])
      sheet.addRow(['1', template.name, periodStart, periodEnd])
      fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
    } else if (format === 'pdf') {
      fileBuffer = await new Promise((resolve) => {
        const doc = new PDFDocument()
        const buffers: Buffer[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => resolve(Buffer.concat(buffers)))
        doc.fontSize(25).text(`LuxSalon Report: ${template.name}`, 50, 50)
        doc.fontSize(14).text(`Period: ${periodStart} to ${periodEnd}`, 50, 100)
        doc.text(`Generated By: ${generatedBy}`, 50, 130)
        doc.end()
      })
    } else {
      fileBuffer = Buffer.from(`ID,Template Name,Period Start,Period End\n1,${template.name},${periodStart},${periodEnd}`)
    }

    const filename = `reports/${templateId}_${Date.now()}.${format}`
    const { data: uploadData, error: uploadErr } = await supabase.storage.from('documents').upload(filename, fileBuffer, {
      contentType: format === 'pdf' ? 'application/pdf' : format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
    })

    let fileUrl = `https://storage.supabase.co/documents/${filename}`
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filename)
      fileUrl = urlData.publicUrl
    } else if (uploadErr) {
      console.error('Failed to upload report to Supabase', uploadErr)
    }

    const { data, error } = await supabase.from('exported_reports').insert({
      template_id:  templateId,
      format,
      file_url:     fileUrl,
      file_size:    fileBuffer.length,
      generated_by: generatedBy,
      period_start: periodStart,
      period_end:   periodEnd,
    }).select().single() as any

    await supabase.from('report_templates').update({ last_run: new Date().toISOString() }).eq('id', templateId)

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getReportHistory(): Promise<ApiResponse<ExportedReport[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('exported_reports').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Zapier Webhooks ──────────────────────────────────────────
  async triggerZapierEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: zapierConfig } = await supabase
      .from('integration_configs').select('config').eq('provider', 'zapier').eq('is_enabled', true).single() as any
    if (!zapierConfig) return

    const webhookUrl = (zapierConfig.config as Record<string, string>)?.webhook_url
    if (!webhookUrl) return

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        console.error('Zapier webhook failed with status', res.status)
      }
    } catch (err) {
      console.error('Zapier webhook fetch error', err)
    }
  },
}
