/**
 * End-of-Day Reconciliation API
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { dayEndService }              from '@/services/businessService'
import { applyRateLimit }             from '@/lib/ratelimit'
import { generateInvoicePDF }         from '@/lib/pdf'
import { generateCSV }                from '@/lib/pdf'
import { z }                          from 'zod'

const closeSchema = z.object({
  branch_id:   z.string().uuid(),
  cash_actual: z.number().min(0),
  notes:       z.string().max(500).optional(),
})

// GET: Get today's report
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const date     = searchParams.get('date')
  const format   = searchParams.get('format') ?? 'json'

  if (!branchId) return NextResponse.json({ error: 'branch_id required' }, { status: 400 })

  const { data, error } = await dayEndService.generateReport(branchId, date ?? undefined)
  if (error) return NextResponse.json({ error }, { status: 500 })

  if (format === 'csv' && data) {
    const csv = generateCSV(
      ['report_date','total_revenue','cash_expected','cash_actual','card_total','tips_total','refunds_total','appointments_total','appointments_done','no_shows'],
      [data as Record<string, unknown>]
    )
    return new NextResponse(csv as any, {
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="day-end-${date ?? 'today'}.csv"`,
      },
    })
  }

  return NextResponse.json({ data })
}

// POST: Close the day
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, 'admin')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('user_id', session.user.id).single() as any

  if (!staff || !['admin', 'staff'].includes(staff.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await dayEndService.closeDay(
    parsed.data.branch_id,
    staff.id,
    parsed.data.cash_actual,
    parsed.data.notes
  )

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}
