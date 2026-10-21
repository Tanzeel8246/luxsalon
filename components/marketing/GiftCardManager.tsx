'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Gift, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { marketingService } from '@/services/marketingService'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

const statusConfig = {
  active:    { icon: <CheckCircle size={13} />, class: 'bg-green-500/15 text-green-400 border-green-500/30' },
  used:      { icon: <CheckCircle size={13} />, class: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  expired:   { icon: <Clock size={13} />,        class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  cancelled: { icon: <XCircle size={13} />,      class: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export function GiftCardManager() {
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [redeemModal, setRedeemModal] = useState(false)
  const [form, setForm] = useState({
    initial_value:   '',
    recipient_name:  '',
    recipient_email: '',
    message:         '',
  })
  const [redeemCode, setRedeemCode] = useState('')

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['gift-cards'],
    queryFn:  async () => {
      const { data, error } = await marketingService.getGiftCards()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () => marketingService.createGiftCard({
      initial_value:   parseFloat(form.initial_value),
      recipient_name:  form.recipient_name || undefined,
      recipient_email: form.recipient_email || undefined,
      message:         form.message || undefined,
    }),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['gift-cards'] })
      toast.success(`Gift card created: ${result.data?.code}`)
      setCreateModal(false)
      setForm({ initial_value: '', recipient_name: '', recipient_email: '', message: '' })
    },
  })

  const activeCards   = cards.filter(c => c.status === 'active').length
  const totalBalance  = cards.filter(c => c.status === 'active').reduce((s, c) => s + c.balance, 0)
  const totalIssued   = cards.reduce((s, c) => s + c.initial_value, 0)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Gift size={18} className="text-gold-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Gift Cards</h3>
                <p className="text-xs text-gray-500">{activeCards} active · {formatCurrency(totalBalance)} outstanding</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRedeemModal(true)}>Redeem</Button>
              <Button size="sm" icon={<Plus size={13} />} onClick={() => setCreateModal(true)}>Issue</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Issued',   value: formatCurrency(totalIssued),  color: 'text-white' },
              { label: 'Outstanding',    value: formatCurrency(totalBalance),  color: 'text-gold-400' },
              { label: 'Active Cards',   value: activeCards,                   color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {cards.slice(0, 12).map((card, i) => {
              const cfg = (statusConfig as any)[card.status]
              const usedPct = ((card.initial_value - card.balance) / card.initial_value) * 100
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/2"
                >
                  <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                    <Gift size={16} className="text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium text-white">{card.code}</p>
                      <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border', cfg.class)}>
                        {cfg.icon}
                        {card.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {card.recipient_name ?? 'General'} · Expires {card.expires_at ? formatDate(card.expires_at) : 'Never'}
                    </p>
                    <div className="mt-1.5 h-1 w-full bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-500 rounded-full" style={{ width: `${100 - usedPct}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gold-400">{formatCurrency(card.balance)}</p>
                    <p className="text-xs text-gray-500">of {formatCurrency(card.initial_value)}</p>
                  </div>
                </motion.div>
              )
            })}
            {cards.length === 0 && !isLoading && (
              <p className="text-center text-gray-500 py-6 text-sm">No gift cards issued yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Issue Gift Card" size="sm">
        <div className="space-y-4">
          <Input label="Amount ($)" type="number" placeholder="50" value={form.initial_value} onChange={e => setForm(p => ({ ...p, initial_value: e.target.value }))} prefix={<span className="text-gold-400 font-bold">$</span>} />
          <Input label="Recipient Name" placeholder="John Doe" value={form.recipient_name} onChange={e => setForm(p => ({ ...p, recipient_name: e.target.value }))} />
          <Input label="Recipient Email" type="email" placeholder="john@example.com" value={form.recipient_email} onChange={e => setForm(p => ({ ...p, recipient_email: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Personal Message</label>
            <textarea placeholder="Happy Birthday! Enjoy your pampering..." value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3} className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:border-gold-500/50 resize-none" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={createMutation.isPending} disabled={!form.initial_value} onClick={() => createMutation.mutate()}>Issue Card</Button>
          </div>
        </div>
      </Modal>

      {/* Redeem modal */}
      <Modal open={redeemModal} onClose={() => setRedeemModal(false)} title="Redeem Gift Card" size="sm">
        <div className="space-y-4">
          <Input label="Gift Card Code" placeholder="ABC1-DEF2-GHI3" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} prefix={<Gift size={14} />} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRedeemModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { toast.success('Ready to apply at checkout!'); setRedeemModal(false) }}>Check Balance</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
