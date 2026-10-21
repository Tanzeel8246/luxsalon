import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/services/aiService'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7', 10)

  const { data, error } = await aiService.getForecasts(days)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST() {
  const { data, error } = await aiService.forecastDemand(7)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data, generated_at: new Date().toISOString() })
}
