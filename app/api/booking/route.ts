import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { bookingService } from '@/services/bookingService'
import { pricingService } from '@/services/pricingService'
import { marketingService } from '@/services/marketingService'
import { z } from 'zod'

const bookingSchema = z.object({
  service_id:  z.string().uuid(),
  staff_id:    z.string().uuid(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:        z.string().regex(/^\d{2}:\d{2}$/),
  package_id:  z.string().uuid().optional(),
  notes:       z.string().max(500).optional(),
  promo_code:  z.string().max(50).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body   = await request.json()
  const parsed = bookingSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', session.user.id)
    .single() as any as any

  if (!customer) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 })
  }

  const { data: service } = await supabase
    .from('services').select('*').eq('id', parsed.data.service_id).single() as any as any
  const { data: staff } = await supabase
    .from('staff').select('*').eq('id', parsed.data.staff_id).single() as any as any

  const result = await bookingService.createAppointment(parsed.data, customer.id)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  // Send WhatsApp confirmation
  if (customer.phone && service && staff && result.data) {
    const price = await pricingService.calculatePrice(
      parsed.data.service_id,
      `${parsed.data.date}T${parsed.data.time}:00`,
      customer.id
    )
    await marketingService.sendAppointmentConfirmation({
      customer_name:  customer.name,
      customer_phone: customer.phone,
      customer_id:    customer.id,
      date:           parsed.data.date,
      time:           parsed.data.time,
      service:        service.name,
      staff:          staff.name,
      amount:         `$${price.total.toFixed(2)}`,
    })
  }

  return NextResponse.json({ data: result.data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase   = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get('service_id')
  const date      = searchParams.get('date')

  if (!serviceId || !date) {
    return NextResponse.json({ error: 'service_id and date are required' }, { status: 400 })
  }

  const { data, error } = await bookingService.getAvailableSlots(serviceId, date)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ data })
}
