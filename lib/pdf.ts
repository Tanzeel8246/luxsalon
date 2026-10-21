/**
 * PDF Generation — @react-pdf/renderer
 * Generates: Invoices, Payroll slips, Day-end reports, Export CSVs
 * Uploads to Supabase Storage → returns signed URL
 */

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { format, parseISO }          from 'date-fns'
import { logger }                    from '@/lib/logger'

// ── Shared Styles ─────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:    { backgroundColor: '#FFF', padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  hdr:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, borderBottomWidth: 2, borderBottomColor: '#D4AF37', paddingBottom: 14 },
  logo:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#D4AF37' },
  logoSub: { fontSize: 9, color: '#888', marginTop: 2 },
  title:   { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  subInfo: { fontSize: 9, color: '#666', textAlign: 'right', marginTop: 3 },
  secHead: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 },
  sec:     { marginBottom: 18 },
  rowHdr:  { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f5f5f5', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  col:     { flex: 1, color: '#333' },
  colR:    { textAlign: 'right', color: '#333' },
  totRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1.5, borderTopColor: '#D4AF37', marginTop: 8 },
  totLbl:  { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  totVal:  { fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#D4AF37', textAlign: 'right' },
  footer:  { position: 'absolute', bottom: 28, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#e5e5e5', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footTxt: { fontSize: 8, color: '#aaa' },
  badge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  paid:    { backgroundColor: '#d1fae5', color: '#065f46' },
  pending: { backgroundColor: '#fef3c7', color: '#92400e' },
  infoBox: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 5, marginBottom: 18 },
})

// ── Invoice PDF ───────────────────────────────────────────────────────────────

export interface InvoiceData {
  invoice_number: string
  issue_date:     string
  status:         string
  currency:       string
  notes?:         string
  customer: { name: string; email: string; phone?: string }
  salon:    { name: string; address: string; phone: string }
  items:    Array<{ description: string; quantity: number; unit_price: number; total: number }>
  subtotal:       number
  tax_total:      number
  discount_total: number
  grand_total:    number
}

function InvoiceDoc({ d }: { d: InvoiceData }) {
  const cur = d.currency.toUpperCase()
  return React.createElement(Document, { title: `Invoice ${d.invoice_number}`, author: d.salon.name },
    React.createElement(Page, { size: 'A4', style: S.page },
      // Header
      React.createElement(View, { style: S.hdr },
        React.createElement(View, null,
          React.createElement(Text, { style: S.logo }, d.salon.name),
          React.createElement(Text, { style: S.logoSub }, d.salon.address),
          React.createElement(Text, { style: S.logoSub }, d.salon.phone),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: S.title }, 'INVOICE'),
          React.createElement(Text, { style: S.subInfo }, `#${d.invoice_number}`),
          React.createElement(Text, { style: S.subInfo }, `Date: ${format(parseISO(d.issue_date), 'MMM d, yyyy')}`),
          React.createElement(View, { style: [S.badge, d.status === 'paid' ? S.paid : S.pending] },
            React.createElement(Text, null, d.status.toUpperCase()),
          ),
        ),
      ),
      // Bill To
      React.createElement(View, { style: S.sec },
        React.createElement(Text, { style: S.secHead }, 'Bill To'),
        React.createElement(Text, null, d.customer.name),
        React.createElement(Text, { style: { color: '#666' } }, d.customer.email),
        d.customer.phone ? React.createElement(Text, { style: { color: '#666' } }, d.customer.phone) : null,
      ),
      // Items
      React.createElement(View, { style: S.sec },
        React.createElement(Text, { style: S.secHead }, 'Services'),
        React.createElement(View, { style: S.rowHdr },
          React.createElement(Text, { style: [S.col, { flex: 3 }] }, 'Description'),
          React.createElement(Text, { style: S.col }, 'Qty'),
          React.createElement(Text, { style: [S.col, { textAlign: 'right' }] }, 'Unit Price'),
          React.createElement(Text, { style: [S.col, { textAlign: 'right' }] }, 'Total'),
        ),
        ...d.items.map((item, i) =>
          React.createElement(View, { key: i, style: S.row },
            React.createElement(Text, { style: [S.col, { flex: 3 }] }, item.description),
            React.createElement(Text, { style: S.col }, String(item.quantity)),
            React.createElement(Text, { style: [S.col, { textAlign: 'right' }] }, `${cur} ${item.unit_price.toFixed(2)}`),
            React.createElement(Text, { style: [S.col, { textAlign: 'right' }] }, `${cur} ${item.total.toFixed(2)}`),
          )
        ),
      ),
      // Totals
      React.createElement(View, { style: { alignItems: 'flex-end', marginBottom: 24 } },
        React.createElement(View, { style: { width: 230 } },
          React.createElement(View, { style: S.row },
            React.createElement(Text, { style: S.col }, 'Subtotal'),
            React.createElement(Text, { style: S.colR }, `${cur} ${d.subtotal.toFixed(2)}`),
          ),
          d.discount_total > 0 ? React.createElement(View, { style: S.row },
            React.createElement(Text, { style: [S.col, { color: '#059669' }] }, 'Discount'),
            React.createElement(Text, { style: [S.colR, { color: '#059669' }] }, `- ${cur} ${d.discount_total.toFixed(2)}`),
          ) : null,
          React.createElement(View, { style: S.row },
            React.createElement(Text, { style: S.col }, 'Tax'),
            React.createElement(Text, { style: S.colR }, `${cur} ${d.tax_total.toFixed(2)}`),
          ),
          React.createElement(View, { style: S.totRow },
            React.createElement(Text, { style: S.totLbl }, 'TOTAL DUE'),
            React.createElement(Text, { style: S.totVal }, `${cur} ${d.grand_total.toFixed(2)}`),
          ),
        ),
      ),
      d.notes ? React.createElement(View, { style: S.infoBox },
        React.createElement(Text, { style: S.secHead }, 'Notes'),
        React.createElement(Text, { style: { color: '#555' } }, d.notes),
      ) : null,
      // Footer
      React.createElement(View, { style: S.footer },
        React.createElement(Text, { style: S.footTxt }, `${d.salon.name} · ${format(new Date(), 'MMM d, yyyy h:mm a')}`),
        React.createElement(Text, { style: S.footTxt }, 'Thank you for your visit!'),
      ),
    )
  )
}

// ── Payroll Slip ──────────────────────────────────────────────────────────────

export interface PayrollData {
  staff_name: string; staff_role: string; salon_name: string
  period_start: string; period_end: string; currency: string
  appointments: number
  base_salary: number; commission_earned: number; tips_earned: number
  bonuses: number; deductions: number; gross_total: number
  tax_deducted: number; net_pay: number
}

function PayrollDoc({ d }: { d: PayrollData }) {
  const cur  = d.currency.toUpperCase()
  const rows = [
    { label: 'Base Salary',       val: d.base_salary,       type: 'credit' },
    { label: 'Commission',        val: d.commission_earned, type: 'credit' },
    { label: 'Tips',              val: d.tips_earned,       type: 'credit' },
    { label: 'Bonuses',           val: d.bonuses,           type: 'credit' },
    { label: 'Deductions',        val: d.deductions,        type: 'debit'  },
    { label: 'Gross Total',       val: d.gross_total,       type: 'total'  },
    { label: 'Tax Withheld',      val: d.tax_deducted,      type: 'debit'  },
  ]
  return React.createElement(Document, { title: `Payslip — ${d.staff_name}` },
    React.createElement(Page, { size: 'A4', style: S.page },
      React.createElement(View, { style: S.hdr },
        React.createElement(View, null,
          React.createElement(Text, { style: S.logo }, d.salon_name),
          React.createElement(Text, { style: S.logoSub }, 'Payroll Statement'),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: { ...S.title, fontSize: 14 } }, 'PAYSLIP'),
          React.createElement(Text, { style: S.subInfo },
            `${format(parseISO(d.period_start), 'MMM d')} – ${format(parseISO(d.period_end), 'MMM d, yyyy')}`),
        ),
      ),
      React.createElement(View, { style: S.infoBox },
        React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold', fontSize: 13 } }, d.staff_name),
        React.createElement(Text, { style: { color: '#D4AF37', marginTop: 2 } }, d.staff_role),
        React.createElement(Text, { style: { color: '#666', marginTop: 4 } }, `${d.appointments} appointments · ${d.period_start} to ${d.period_end}`),
      ),
      React.createElement(View, { style: S.sec },
        React.createElement(Text, { style: S.secHead }, 'Earnings & Deductions'),
        ...rows.map((row, i) =>
          React.createElement(View, { key: i, style: { ...S.row, ...(row.type === 'total' ? { borderTopWidth: 1.5, borderTopColor: '#333', marginTop: 8, paddingTop: 8 } : {}) } },
            React.createElement(Text, { style: { ...S.col, ...(row.type === 'total' ? { fontFamily: 'Helvetica-Bold' } : {}) } }, row.label),
            React.createElement(Text, { style: { ...S.colR, color: row.type === 'debit' ? '#dc2626' : row.type === 'total' ? '#1a1a1a' : '#059669', ...(row.type === 'total' ? { fontFamily: 'Helvetica-Bold' } : {}) } },
              `${row.type === 'debit' ? '- ' : ''}${cur} ${row.val.toFixed(2)}`),
          )
        ),
        React.createElement(View, { style: S.totRow },
          React.createElement(Text, { style: S.totLbl }, 'NET PAY'),
          React.createElement(Text, { style: S.totVal }, `${cur} ${d.net_pay.toFixed(2)}`),
        ),
      ),
      React.createElement(View, { style: S.footer },
        React.createElement(Text, { style: S.footTxt }, 'Computer-generated — no signature required'),
        React.createElement(Text, { style: S.footTxt }, `Generated: ${format(new Date(), 'MMM d, yyyy')}`),
      ),
    )
  )
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadPDF(
  buffer:   Buffer,
  path:     string,
  entityId: string,
  table:    string,
  field:    string
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  const supabase = createAdminSupabaseClient()
  const bucket   = process.env.SUPABASE_STORAGE_BUCKET ?? 'luxsalon-assets'

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: 'application/pdf', cacheControl: '3600', upsert: true })

  if (upErr) {
    logger.error('PDF upload failed', { path, error: upErr })
    return { url: null, error: upErr.message }
  }

  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (!signed?.signedUrl) return { url: null, error: 'Signed URL creation failed' }

  await supabase.from(table as never).update({ [field]: signed.signedUrl } as never).eq('id', entityId)

  logger.info('PDF generated and uploaded', { path, entityId })
  return { url: signed.signedUrl, error: null }
}

// ── Public Functions ──────────────────────────────────────────────────────────

export async function generateInvoicePDF(data: InvoiceData, invoiceId: string) {
  const buf = await renderToBuffer(React.createElement(InvoiceDoc, { d: data }) as any)
  return uploadPDF(buf, `invoices/${invoiceId}.pdf`, invoiceId, 'invoices', 'pdf_url')
}

export async function generatePayrollPDF(data: PayrollData, payrollId: string) {
  const buf = await renderToBuffer(React.createElement(PayrollDoc, { d: data }) as any)
  return uploadPDF(buf, `payroll/${payrollId}.pdf`, payrollId, 'staff_payroll', 'notes')
}

export function generateCSV(headers: string[], rows: Array<Record<string, unknown>>): Buffer {
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v

  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(String(row[h] ?? ''))).join(',')),
  ]
  return Buffer.from(lines.join('\n'), 'utf-8')
}
