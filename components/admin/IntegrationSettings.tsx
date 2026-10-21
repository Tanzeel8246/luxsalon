'use client'
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Key, Webhook, Save, CheckCircle, XCircle, Loader2,
  Eye, EyeOff, TestTube2, Brain, Zap
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getSupabaseClient } from '@/lib/supabase'
import { zapierService } from '@/services/zapierService'
import toast from 'react-hot-toast'

interface IntegrationConfig {
  provider:   string
  config:     Record<string, string>
  is_enabled: boolean
}

async function getIntegrationConfig(provider: string): Promise<IntegrationConfig | null> {
  const supabase = getSupabaseClient()
  const { data } = await (supabase as any)
    .from('integration_configs')
    .select('*')
    .eq('provider', provider)
    .single()
  return data as IntegrationConfig | null
}

async function saveIntegrationConfig(provider: string, config: Record<string, string>, enabled: boolean) {
  const supabase = getSupabaseClient()
  const { error } = await (supabase as any)
    .from('integration_configs')
    .upsert({ provider, config, is_enabled: enabled }, { onConflict: 'provider' })
  if (error) throw new Error(error.message)
}

export function IntegrationSettings() {
  const qc = useQueryClient()

  // Gemini
  const [geminiKey,        setGeminiKey]        = useState('')
  const [geminiEnabled,    setGeminiEnabled]    = useState(true)
  const [showGeminiKey,    setShowGeminiKey]    = useState(false)
  const [geminiTesting,    setGeminiTesting]    = useState(false)
  const [geminiStatus,     setGeminiStatus]     = useState<'idle' | 'ok' | 'fail'>('idle')

  // Zapier
  const [zapierUrl,        setZapierUrl]        = useState('')
  const [zapierEnabled,    setZapierEnabled]    = useState(false)
  const [zapierTesting,    setZapierTesting]    = useState(false)
  const [zapierStatus,     setZapierStatus]     = useState<'idle' | 'ok' | 'fail'>('idle')

  // Load existing configs
  const { data: geminiConfig } = useQuery({
    queryKey: ['integration-config', 'gemini'],
    queryFn:  () => getIntegrationConfig('gemini'),
  })

  const { data: zapierConfig } = useQuery({
    queryKey: ['integration-config', 'zapier'],
    queryFn:  () => getIntegrationConfig('zapier'),
  })

  useEffect(() => {
    if (geminiConfig) {
      setGeminiKey(geminiConfig.config?.api_key || '')
      setGeminiEnabled(geminiConfig.is_enabled)
    }
  }, [geminiConfig])

  useEffect(() => {
    if (zapierConfig) {
      setZapierUrl(zapierConfig.config?.webhook_url || '')
      setZapierEnabled(zapierConfig.is_enabled)
    }
  }, [zapierConfig])

  const saveGemini = async () => {
    try {
      await saveIntegrationConfig('gemini', { api_key: geminiKey }, geminiEnabled)
      qc.invalidateQueries({ queryKey: ['integration-config', 'gemini'] })
      toast.success('Gemini API Key محفوظ کر دی گئی!')
    } catch (err: any) {
      toast.error('محفوظ کرنے میں ناکامی: ' + err.message)
    }
  }

  const testGemini = async () => {
    if (!geminiKey) {
      toast.error('پہلے API Key درج کریں')
      return
    }
    setGeminiTesting(true)
    setGeminiStatus('idle')
    try {
      // First save the key so getGeminiClient picks it up
      await saveIntegrationConfig('gemini', { api_key: geminiKey }, true)

      const response = await fetch('/api/ai/test', { method: 'POST' })
      const result   = await response.json()

      if (result.ok) {
        setGeminiStatus('ok')
        toast.success('Gemini AI کنکشن کامیاب!')
      } else {
        setGeminiStatus('fail')
        toast.error('Gemini کنکشن ناکام: ' + (result.error || 'Unknown error'))
      }
    } catch (err: any) {
      setGeminiStatus('fail')
      toast.error('ٹیسٹ ناکام: ' + err.message)
    } finally {
      setGeminiTesting(false)
    }
  }

  const saveZapier = async () => {
    try {
      await saveIntegrationConfig('zapier', { webhook_url: zapierUrl }, zapierEnabled)
      qc.invalidateQueries({ queryKey: ['integration-config', 'zapier'] })
      toast.success('Zapier Webhook محفوظ کر دیا گیا!')
    } catch (err: any) {
      toast.error('محفوظ کرنے میں ناکامی: ' + err.message)
    }
  }

  const testZapier = async () => {
    if (!zapierUrl) {
      toast.error('پہلے Webhook URL درج کریں')
      return
    }
    setZapierTesting(true)
    setZapierStatus('idle')

    // Save webhook url first
    await saveIntegrationConfig('zapier', { webhook_url: zapierUrl }, true)

    const result = await zapierService.testConnection()
    setZapierStatus(result.success ? 'ok' : 'fail')
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
    setZapierTesting(false)
  }

  const StatusIcon = ({ status }: { status: 'idle' | 'ok' | 'fail' }) => {
    if (status === 'ok')   return <CheckCircle size={14} className="text-green-400" />
    if (status === 'fail') return <XCircle     size={14} className="text-red-400" />
    return null
  }

  return (
    <div className="space-y-4">

      {/* ── Gemini AI ─────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Brain size={18} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Google Gemini AI</h3>
                  <p className="text-xs text-gray-500">AI فورکاسٹ، چرن ڈیٹیکشن، رپورٹ سمری</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-400">فعال</span>
                <div
                  onClick={() => setGeminiEnabled(!geminiEnabled)}
                  className={`w-9 h-5 rounded-full border transition-all relative cursor-pointer ${
                    geminiEnabled ? 'bg-purple-500/30 border-purple-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    geminiEnabled ? 'left-4 bg-purple-400' : 'left-0.5 bg-gray-600'
                  }`} />
                </div>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Gemini API Key</label>
              <div className="relative">
                <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-8 pr-10 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showGeminiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                اپنی Gemini API key یہاں سے حاصل کریں:{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                  className="text-purple-400 hover:underline">aistudio.google.com</a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testGemini}
                disabled={geminiTesting || !geminiKey}
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1"
              >
                {geminiTesting
                  ? <><Loader2 size={12} className="animate-spin" /> ٹیسٹ ہو رہا ہے...</>
                  : <><TestTube2 size={12} /> کنکشن ٹیسٹ</>
                }
                <StatusIcon status={geminiStatus} />
              </Button>
              <Button
                onClick={saveGemini}
                disabled={!geminiKey}
                size="sm"
                className="gap-1.5 flex-1"
              >
                <Save size={12} /> محفوظ کریں
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Zapier ───────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <Zap size={18} className="text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Zapier Webhooks</h3>
                  <p className="text-xs text-gray-500">بکنگ، کسٹمر اور سٹاک ایونٹس کا آٹومیشن</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-400">فعال</span>
                <div
                  onClick={() => setZapierEnabled(!zapierEnabled)}
                  className={`w-9 h-5 rounded-full border transition-all relative cursor-pointer ${
                    zapierEnabled ? 'bg-orange-500/30 border-orange-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    zapierEnabled ? 'left-4 bg-orange-400' : 'left-0.5 bg-gray-600'
                  }`} />
                </div>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Zapier Webhook URL</label>
              <div className="relative">
                <Webhook size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="url"
                  value={zapierUrl}
                  onChange={e => setZapierUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Zapier پر نئی Zap بنائیں اور Webhook trigger کا URL یہاں پیسٹ کریں
              </p>
            </div>

            {/* Supported events */}
            <div className="p-3 rounded-lg bg-white/3 border border-white/6">
              <p className="text-xs font-medium text-gray-400 mb-2">سپورٹڈ ایونٹس:</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  'new_booking', 'booking_completed', 'booking_cancelled',
                  'vip_customer_arrived', 'low_stock_alert', 'new_customer',
                  'churn_risk_detected', 'payment_received'
                ].map(ev => (
                  <div key={ev} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-orange-400/60" />
                    <span className="text-xs text-gray-500">{ev.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testZapier}
                disabled={zapierTesting || !zapierUrl}
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1"
              >
                {zapierTesting
                  ? <><Loader2 size={12} className="animate-spin" /> ٹیسٹ ہو رہا ہے...</>
                  : <><TestTube2 size={12} /> کنکشن ٹیسٹ</>
                }
                <StatusIcon status={zapierStatus} />
              </Button>
              <Button
                onClick={saveZapier}
                disabled={!zapierUrl}
                size="sm"
                className="gap-1.5 flex-1"
              >
                <Save size={12} /> محفوظ کریں
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  )
}
