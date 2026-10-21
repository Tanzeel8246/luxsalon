import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/services/aiService'
import type { ChatMessage } from '@/types/modules'

export async function POST(request: NextRequest) {
  const body    = await request.json()
  const { message, history = [] } = body as { message: string; history: ChatMessage[] }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const { data: reply, error } = await aiService.processChat(message, history)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({
    reply,
    timestamp: new Date().toISOString(),
  })
}
