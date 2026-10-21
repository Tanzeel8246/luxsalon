/**
 * Google Calendar OAuth Callback
 * After user authorizes calendar access, Google redirects here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback }       from '@/lib/googleCalendar'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { logger }                    from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code   = searchParams.get('code')
  const state  = searchParams.get('state')   // userId passed through OAuth
  const error  = searchParams.get('error')

  if (error) {
    logger.warn('Google Calendar OAuth denied', { error })
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/system?error=calendar_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/system?error=missing_params`
    )
  }

  // Verify the state (userId) belongs to current session
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.id !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?error=session_mismatch`
    )
  }

  try {
    await handleOAuthCallback(code, state)
    logger.info('Google Calendar connected successfully', { userId: state })
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/system?success=calendar_connected`
    )
  } catch (err) {
    logger.error('Google Calendar OAuth failed', { err })
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/system?error=calendar_failed`
    )
  }
}
