import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { depositService }             from '@/services/businessService'
import { applyRateLimit }             from '@/lib/ratelimit'
import { z }                          from 'zod'

const depositSchema = z.object({
  appointment_id: z.string().uuid(),
  amount:         z.number().positive(),
  currency:       z.string().length(3).default('USD'),
})

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, 'public')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = depositSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: customer } = await supabase
    .from('customers').select('email').eq('user_id', session.user.id).single() as any

  const { data, error } = await depositService.createDeposit({
    ...parsed.data,
    customer_email: customer?.email,
  })

  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deposit_id } = await request.json()
  if (!deposit_id) return NextResponse.json({ error: 'deposit_id required' }, { status: 400 })

  const { data, error } = await depositService.confirmDeposit(deposit_id)
  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data })
}
