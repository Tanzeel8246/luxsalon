import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { queueService } from '@/services/queueService'

export async function GET() {
  const { data, error } = await queueService.getActiveQueue()
  if (error) return NextResponse.json({ error }, { status: 500 })
  const { data: stats } = await queueService.getQueueStats()
  return NextResponse.json({ queue: data, stats })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { customer_id, service_id, staff_id } = body

  if (!customer_id || !service_id) {
    return NextResponse.json({ error: 'customer_id and service_id required' }, { status: 400 })
  }

  const { data, error } = await queueService.addToQueue({ customer_id, service_id, staff_id })
  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { queue_id, status } = body

  if (!queue_id || !status) {
    return NextResponse.json({ error: 'queue_id and status required' }, { status: 400 })
  }

  const { data, error } = await queueService.updateStatus(queue_id, status)
  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json({ data })
}
