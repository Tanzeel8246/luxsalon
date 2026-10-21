import { NextResponse } from 'next/server'
import { getGeminiClient } from '@/lib/gemini'

export async function POST() {
  try {
    const gemini = await getGeminiClient()

    if (!gemini) {
      return NextResponse.json({
        ok:    false,
        error: 'No API key configured. Please set your Gemini API key first.',
      }, { status: 400 })
    }

    const response = await gemini.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: 'Say "LuxSalon AI connection successful!" in exactly those words.',
    })

    const text = response.text || ''

    return NextResponse.json({
      ok:      true,
      message: text,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok:    false,
      error: err.message || 'Unknown error',
    }, { status: 500 })
  }
}
