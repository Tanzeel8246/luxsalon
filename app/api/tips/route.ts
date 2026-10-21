import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { tipsService }                from '@/services/businessService'
import { applyRateLimit }             from '@/lib/ratelimit'
import { z }                          from 'zod'

const tipSchema = z.object({
  appointment_id: z.string().uuid(),
  staff_id:       z.string().uuid(),
  customer_id:    z.string().uuid().optional(),
  amount:         z.number().positive(),
  method:         z.enum(['cash','card','wallet','included']),
  transaction_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = tipSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await tipsService.recordTip(parsed.data)
  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const staffId = searchParams.get('staff_id')
  const from    = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const to      = searchParams.get('to')   ?? from

  if (!staffId) return NextResponse.json({ error: 'staff_id required' }, { status: 400 })

  const { data, error } = await tipsService.getStaffTips(staffId, from, to)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}
