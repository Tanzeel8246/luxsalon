import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { customerMergeService }       from '@/services/businessService'
import { applyRateLimit }             from '@/lib/ratelimit'
import { z }                          from 'zod'

const searchSchema = z.object({ q: z.string().min(3).max(100) })
const mergeSchema  = z.object({
  primary_id: z.string().uuid(),
  merged_id:  z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, 'admin')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role').eq('user_id', session.user.id).single() as any
  if (!staff || staff.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const parsed = searchSchema.safeParse({ q: searchParams.get('q') })
  if (!parsed.success) return NextResponse.json({ error: 'q parameter required (min 3 chars)' }, { status: 400 })

  const { data, error } = await customerMergeService.findDuplicates(parsed.data.q)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, 'admin')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('id, role').eq('user_id', session.user.id).single() as any
  if (!staff || staff.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body   = await request.json()
  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.primary_id === parsed.data.merged_id) {
    return NextResponse.json({ error: 'Cannot merge a customer with themselves' }, { status: 400 })
  }

  const { data, error } = await customerMergeService.mergeCustomers(
    parsed.data.primary_id,
    parsed.data.merged_id,
    staff.id
  )

  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data })
}
