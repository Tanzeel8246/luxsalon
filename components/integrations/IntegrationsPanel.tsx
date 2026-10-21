'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Settings, RefreshCw, CheckCircle, XCircle, Clock, Link } from 'lucide-react'
import { integrationService } from '@/services/integrationService'
import { formatDateTime, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
// import type { IntegrationConfig, IntegrationProvider } from '@/types'

const INTEGRATION_META: Record<string, { label: string; icon: string; description: string; color: string; category: string }> = {
  google_calendar:   { label: 'Google Calendar',    icon: '📅', description: 'Sync appointments automatically', color: 'bg-blue-500/10 border-blue-500/20',     category: 'Calendar' },
  apple_calendar:    { label: 'Apple Calendar',     icon: '🍎', description: 'iCloud calendar sync',            color: 'bg-gray-500/10 border-gray-500/20',      category: 'Calendar' },
  stripe:            { label: 'Stripe',             icon: '💳', description: 'Online card payments',            color: 'bg-purple-500/10 border-purple-500/20',  category: 'Payments' },
  paypal:            { label: 'PayPal',             icon: '🅿️',  description: 'PayPal payment gateway',         color: 'bg-blue-500/10 border-blue-500/20',     category: 'Payments' },
  razorpay:          { label: 'Razorpay',           icon: '₹',  description: 'Pakistani/Indian payment',        color: 'bg-blue-500/10 border-blue-500/20',     category: 'Payments' },
  quickbooks:        { label: 'QuickBooks',         icon: '📊', description: 'Accounting & invoices',          color: 'bg-green-500/10 border-green-500/20',    category: 'Accounting' },
  mailchimp:         { label: 'Mailchimp',          icon: '🐵', description: 'Email marketing campaigns',      color: 'bg-yellow-500/10 border-yellow-500/20',  category: 'Marketing' },
  sendgrid:          { label: 'SendGrid',           icon: '📧', description: 'Transactional email delivery',   color: 'bg-blue-500/10 border-blue-500/20',     category: 'Marketing' },
  twilio:            { label: 'Twilio',             icon: '📱', description: 'SMS notifications',              color: 'bg-red-500/10 border-red-500/20',        category: 'Messaging' },
  firebase:          { label: 'Firebase FCM',       icon: '🔥', description: 'Push notifications',             color: 'bg-orange-500/10 border-orange-500/20',  category: 'Messaging' },
  zapier:            { label: 'Zapier',             icon: '⚡', description: '6000+ app integrations',         color: 'bg-orange-500/10 border-orange-500/20',  category: 'Automation' },
  google_mybusiness: { label: 'Google My Business', icon: '🗺️', description: 'Reviews & business info',        color: 'bg-blue-500/10 border-blue-500/20',     category: 'Social' },
  instagram:         { label: 'Instagram',          icon: '📸', description: 'Direct booking from IG',         color: 'bg-pink-500/10 border-pink-500/20',      category: 'Social' },
  facebook:          { label: 'Facebook',           icon: '👍', description: 'FB appointments button',         color: 'bg-blue-500/10 border-blue-500/20',     category: 'Social' },
  whatsapp_business: { label: 'WhatsApp Business',  icon: '💬', description: 'Official WhatsApp API',          color: 'bg-green-500/10 border-green-500/20',   category: 'Messaging' },
  gemini:            { label: 'Gemini AI',          icon: '✨', description: 'Google Gemini ML & Chatbot',     color: 'bg-blue-500/10 border-blue-500/20',     category: 'Automation' },
}

const CATEGORIES = ['All', 'Calendar', 'Payments', 'Accounting', 'Messaging', 'Marketing', 'Automation', 'Social']

export function IntegrationsPanel() {
  const qc = useQueryClient()
  const [activeCategory, setActiveCategory] = useState('All')
  const [configModal, setConfigModal] = useState<string | null>(null)
  const [configValue, setConfigValue] = useState('')

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn:  async () => {
      const { data, error } = await integrationService.getAll()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ provider, enabled }: { provider: string; enabled: boolean }) =>
      integrationService.toggle(provider, enabled),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['integrations'] })
      toast.success(`Integration ${result.data?.is_enabled ? 'enabled' : 'disabled'}!`)
    },
  })

  const getConfig = (provider: string): any | undefined =>
    integrations.find(i => i.provider === provider)

  const syncStatusIcon = (status: string) => {
    const map: Record<string, React.ReactNode> = {
      success: <CheckCircle size={12} className="text-green-400" />,
      error:   <XCircle size={12} className="text-red-400" />,
      syncing: <RefreshCw size={12} className="text-blue-400 animate-spin" />,
      idle:    <Clock size={12} className="text-gray-500" />,
    }
    return map[status] ?? map.idle
  }

  const filtered = Object.entries(INTEGRATION_META).filter(([, m]) =>
    activeCategory === 'All' || m.category === activeCategory
  )

  const enabledCount = integrations.filter(i => i.is_enabled).length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Link size={18} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Integrations</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {enabledCount}/{Object.keys(INTEGRATION_META).length} connected
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                  activeCategory === cat
                    ? 'bg-gold-500/15 border-gold-500/35 text-gold-400'
                    : 'bg-white/4 border-white/8 text-gray-500 hover:text-gray-300'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Integration cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(([provider, meta], i) => {
              const config  = getConfig(provider)
              const enabled = config?.is_enabled ?? false
              return (
                <motion.div
                  key={provider}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-xl border transition-all',
                    enabled ? meta.color : 'border-white/7 bg-white/2'
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-xl shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white">{meta.label}</p>
                      {config && syncStatusIcon(config.sync_status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.description}</p>
                    {config?.last_sync && (
                      <p className="text-xs text-gray-600 mt-0.5">{formatDateTime(config.last_sync)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {enabled && (
                      <button
                        onClick={() => setConfigModal(provider)}
                        className="p-1.5 rounded-lg bg-white/8 text-gray-400 hover:text-white transition-colors"
                      >
                        <Settings size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleMutation.mutate({ provider: provider, enabled: !enabled })}
                      className={cn(
                        'relative w-11 h-6 rounded-full border transition-all',
                        enabled ? 'bg-gold-500/30 border-gold-500/50' : 'bg-white/8 border-white/15'
                      )}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full transition-all',
                        enabled ? 'right-0.5 bg-gold-400' : 'left-0.5 bg-gray-500'
                      )} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Modal open={!!configModal} onClose={() => setConfigModal(null)} title={`Configure ${configModal ? INTEGRATION_META[configModal]?.label : ''}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
            <span className="text-2xl">{configModal ? INTEGRATION_META[configModal]?.icon : ''}</span>
            <p className="text-sm text-gray-300">{configModal ? INTEGRATION_META[configModal]?.description : ''}</p>
          </div>
          <Input
            label="API Key / Webhook URL"
            placeholder="Paste your API key or webhook URL..."
            value={configValue}
            onChange={e => setConfigValue(e.target.value)}
            prefix={<Link size={13} />}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfigModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              if (configModal) {
                integrationService.configure(configModal, { api_key: configValue })
                toast.success('Configuration saved!')
                setConfigModal(null)
              }
            }}>Save Config</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
