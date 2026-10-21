/**
 * Reports API — PDF, Excel, CSV generation
 * Replaces mock file URLs with real generated files.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { generateInvoicePDF, generateCSV } from '@/lib/pdf'
import { applyRateLimit }             from '@/lib/ratelimit'
import { analyticsService }           from '@/services/analyticsService'
import { staffService }               from '@/services/staffService'
import { format, subDays }            from 'date-fns'
import ExcelJS                        from 'exceljs'

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, 'admin')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('user_id', session.user.id).single() as any
  if (!staff || !['admin', 'staff'].includes(staff.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type   = searchParams.get('type')    // revenue | staff | appointments | inventory
  const fmt    = searchParams.get('format')  // csv | xlsx | json
  const days   = parseInt(searchParams.get('days') ?? '30', 10)
  const from   = searchParams.get('from')    ?? format(subDays(new Date(), days), 'yyyy-MM-dd')
  const to     = searchParams.get('to')      ?? format(new Date(), 'yyyy-MM-dd')

  // ── Revenue Report ──────────────────────────────────────────────────────────
  if (type === 'revenue') {
    const { data: chartData } = await analyticsService.getRevenueChart(days)
    const rows = (chartData ?? []).map(d => ({
      date:         d.date,
      revenue:      d.revenue,
      appointments: d.count,
      avg_ticket:   d.count > 0 ? Math.round(d.revenue / d.count * 100) / 100 : 0,
    }))

    if (fmt === 'csv') {
      const csv = generateCSV(['date','revenue','appointments','avg_ticket'], rows)
      return new NextResponse(csv as any, {
        headers: {
          'Content-Type':        'text/csv',
          'Content-Disposition': `attachment; filename="revenue-${from}-${to}.csv"`,
        },
      })
    }

    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'LuxSalon'
      const ws   = wb.addWorksheet('Revenue')

      ws.columns = [
        { header: 'Date',         key: 'date',         width: 15 },
        { header: 'Revenue',      key: 'revenue',      width: 12 },
        { header: 'Appointments', key: 'appointments', width: 15 },
        { header: 'Avg Ticket',   key: 'avg_ticket',   width: 12 },
      ]

      ws.getRow(1).font = { bold: true, color: { argb: 'FFD4AF37' } }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }

      rows.forEach(r => ws.addRow(r))

      // Sum row
      ws.addRow({
        date:         'TOTAL',
        revenue:      rows.reduce((s, r) => s + r.revenue, 0),
        appointments: rows.reduce((s, r) => s + r.appointments, 0),
        avg_ticket:   '',
      })
      ws.lastRow!.font = { bold: true }

      const buffer = await wb.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="revenue-${from}-${to}.xlsx"`,
        },
      })
    }

    return NextResponse.json({ data: rows })
  }

  // ── Staff Performance Report ────────────────────────────────────────────────
  if (type === 'staff') {
    const { data: performance } = await staffService.getPerformance()
    const rows = (performance ?? []).map(p => ({
      name:             p.staff.name,
      email:            p.staff.email,
      role:             p.staff.role,
      rating:           p.avg_rating,
      appointments:     p.appointments_today,
      revenue:          p.revenue_today,
      completion_rate:  p.completion_rate,
    }))

    if (fmt === 'csv') {
      const csv = generateCSV(['name','email','role','rating','appointments','revenue','completion_rate'], rows)
      return new NextResponse(csv as any, {
        headers: {
          'Content-Type':        'text/csv',
          'Content-Disposition': `attachment; filename="staff-performance-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
        },
      })
    }

    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Staff Performance')
      ws.columns = [
        { header: 'Name',         key: 'name',            width: 20 },
        { header: 'Email',        key: 'email',           width: 25 },
        { header: 'Role',         key: 'role',            width: 12 },
        { header: 'Rating',       key: 'rating',          width: 10 },
        { header: 'Appointments', key: 'appointments',    width: 15 },
        { header: 'Revenue',      key: 'revenue',         width: 12 },
        { header: 'Completion %', key: 'completion_rate', width: 14 },
      ]
      ws.getRow(1).font = { bold: true }
      rows.forEach(r => ws.addRow(r))

      const buffer = await wb.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="staff-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
        },
      })
    }

    return NextResponse.json({ data: rows })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}
