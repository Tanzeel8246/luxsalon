import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'

export async function GET() {
  const start   = Date.now()
  const supabase = createAdminSupabaseClient()

  const { error } = await (supabase as any).from('services').select('id').limit(1).single() as any
  const dbLatency = Date.now() - start

  return NextResponse.json({
    status:    error ? 'degraded' : 'healthy',
    version:   '4.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status:     error ? 'error' : 'healthy',
        latency_ms: dbLatency,
      },
      api: { status: 'healthy' },
    },
    uptime_seconds: process.uptime(),
  }, {
    status: error ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
