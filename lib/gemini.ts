import { GoogleGenAI } from '@google/genai'
import { getSupabaseClient } from './supabase'

export async function getGeminiClient(): Promise<GoogleGenAI | null> {
  const supabase = getSupabaseClient()
  const { data: config } = await (supabase as any)
    .from('integration_configs')
    .select('config, is_enabled')
    .eq('provider', 'gemini')
    .single()

  let apiKey = process.env.GEMINI_API_KEY
  
  if (config?.is_enabled && config.config && (config.config as any).api_key) {
    apiKey = (config.config as any).api_key
  }

  if (!apiKey) {
    return null
  }

  return new GoogleGenAI({ apiKey })
}
