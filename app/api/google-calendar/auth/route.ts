/**
 * Initiate Google Calendar OAuth flow.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { generateAuthUrl }            from '@/lib/googleCalendar'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { applyRateLimit }             from '@/lib/ratelimit'

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, 'auth')
  if (limited) return limited

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authUrl = generateAuthUrl(session.user.id)
  return NextResponse.redirect(authUrl)
}
