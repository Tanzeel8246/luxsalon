/**
 * Vercel Cron — Appointment Reminders
 * Runs every 15 minutes via vercel.json crons config.
 * Sends WhatsApp reminders 24h before appointments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger }                    from '@/lib/logger'

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (not public)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Import scheduler lazily to avoid SSR issues
    const { sendAppointmentReminders } = await import('@/lib/scheduler')
    await (sendAppointmentReminders as () => Promise<void>)()

    logger.info('Cron: appointment reminders sent')
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString() })
  } catch (err) {
    logger.error('Cron: reminder job failed', { err })
    return NextResponse.json({ error: 'Job failed' }, { status: 500 })
  }
}
