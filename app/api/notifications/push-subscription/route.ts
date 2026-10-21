/**
 * Web Push Subscription Storage
 * Saves WebPush subscriptions from the browser (via sw.js)
 */
import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { applyRateLimit }             from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
  }

  await (supabase as any).from('device_tokens').upsert({
    user_id:    session.user.id,
    token:      endpoint,
    platform:   'web',
    is_active:  true,
  }, { onConflict: 'user_id,token' })

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await request.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  await (supabase as any).from('device_tokens')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .eq('token', endpoint)

  return NextResponse.json({ unsubscribed: true })
}
