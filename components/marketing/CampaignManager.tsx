'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Send, Pause, MessageSquare, Mail, Phone, Bell, BarChart2 } from 'lucide-react'
import { marketingService } from '@/services/marketingService'
import { formatDateTime, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'
// import type { Campaign } from '@/types'

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare size={14} />,
  email:    <Mail size={14} />,
  sms:      <Phone size={14} />,
  push:     <Bell size={14} />,
  all:      <BarChart2 size={14} />,
}

const channelColors: Record<string, string> = {
  whatsapp: 'bg-green-500/15 text-green-400 border-green-500/30',
  email:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sms:      'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  push:     'bg-purple-500/15 text-purple-400 border-purple-500/30',
  all:      'bg-gold-500/15 text-gold-400 border-gold-500/30',
}

const statusColors: Record<string, string> = {
  draft:     'bg-gray-500/15 text-gray-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  running:   'bg-green-500/15 text-green-400',
  paused:    'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-purple-500/15 text-purple-400',
  cancelled: 'bg-red-500/15 text-red-400',
}

export function CampaignManager() {
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    name:             '',
    type:             'whatsapp' as any,
    message_template: '',
    subject:          '',
    target_tiers:     [] as string[],
    target_segment:   'all',
  })

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  async () => {
      const { data, error } = await marketingService.getCampaigns()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () => marketingService.createCampaign({ ...form, created_by: null }),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setCreateModal(false)
      toast.success('Campaign created!')
    },
  })

  const launchMutation = useMutation({
    mutationFn: (id: string) => marketingService.launchCampaign(id),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(`Campaign launched to ${result.data?.recipients} recipients!`)
    },
  })

  const totalSent       = campaigns.reduce((s, c) => s + c.sent_count, 0)
  const totalDelivered  = campaigns.reduce((s, c) => s + c.delivered_count, 0)
  const totalConverted  = campaigns.reduce((s, c) => s + c.converted_count, 0)
  const avgOpenRate     = campaigns.filter(c => c.sent_count > 0)
    .reduce((s, c) => s + (c.opened_count / c.sent_count * 100), 0) / Math.max(1, campaigns.filter(c => c.sent_count > 0).length)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Campaign Manager</h3>
              <p className="text-xs text-gray-500 mt-0.5">WhatsApp · SMS · Email · Push</p>
            </div>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateModal(true)}>
              New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Sent',     value: totalSent.toLocaleString(),              color: 'text-white' },
              { label: 'Delivered',      value: totalDelivered.toLocaleString(),          color: 'text-green-400' },
              { label: 'Avg Open Rate',  value: `${avgOpenRate.toFixed(1)}%`,             color: 'text-blue-400' },
              { label: 'Conversions',    value: totalConverted.toLocaleString(),           color: 'text-gold-400' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Campaign list */}
          <div className="space-y-3">
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            )}
            {campaigns.map((camp, i) => (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-colors"
              >
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0', channelColors[camp.type])}>
                  {channelIcons[camp.type]}
                  {camp.type}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{camp.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColors[camp.status])}>
                      {camp.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      Targets: {camp.target_tiers?.join(', ') || 'all tiers'}
                    </span>
                  </div>
                </div>

                {camp.sent_count > 0 && (
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-500">Sent / Opened</p>
                    <p className="text-sm font-medium text-white">
                      {camp.sent_count} / {camp.opened_count}
                    </p>
                    <p className="text-xs text-gold-400">
                      {camp.sent_count > 0 ? ((camp.opened_count / camp.sent_count) * 100).toFixed(0) : 0}% open rate
                    </p>
                  </div>
                )}

                {camp.status === 'draft' && (
                  <Button
                    size="sm"
                    icon={<Send size={12} />}
                    loading={launchMutation.isPending}
                    onClick={() => launchMutation.mutate(camp.id)}
                  >
                    Launch
                  </Button>
                )}
                {camp.status === 'running' && (
                  <Button size="sm" variant="outline" icon={<Pause size={12} />}>
                    Pause
                  </Button>
                )}
              </motion.div>
            ))}
            {!isLoading && campaigns.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">No campaigns yet. Create your first one!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create campaign modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Campaign" size="lg">
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g. Summer Win-back"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Channel"
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
            options={[
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'email',    label: 'Email' },
              { value: 'sms',      label: 'SMS' },
              { value: 'push',     label: 'Push Notification' },
              { value: 'all',      label: 'All Channels' },
            ]}
          />
          {form.type === 'email' && (
            <Input
              label="Email Subject"
              placeholder="e.g. We have an exclusive offer for you!"
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            />
          )}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Message Template</label>
            <textarea
              placeholder="Use {{name}} for customer name, {{date}} for date..."
              value={form.message_template}
              onChange={e => setForm(p => ({ ...p, message_template: e.target.value }))}
              rows={4}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500/50 resize-none"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">Target Tiers</p>
            <div className="flex gap-2 flex-wrap">
              {['bronze', 'silver', 'gold', 'platinum'].map(tier => (
                <button
                  key={tier}
                  onClick={() => setForm(p => ({
                    ...p,
                    target_tiers: p.target_tiers.includes(tier)
                      ? p.target_tiers.filter(t => t !== tier)
                      : [...p.target_tiers, tier],
                  }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all',
                    form.target_tiers.includes(tier)
                      ? 'bg-gold-500/20 border-gold-500/40 text-gold-400'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  )}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button
              className="flex-1"
              loading={createMutation.isPending}
              disabled={!form.name || !form.message_template}
              onClick={() => createMutation.mutate()}
            >
              Create Campaign
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
