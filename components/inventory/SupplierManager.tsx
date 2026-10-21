'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Plus, Star, Phone, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { inventoryAdvancedService } from '@/services/inventoryAdvancedService'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SkeletonTable } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
// import type { Supplier } from '@/types'

export function SupplierManager() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<any>({ name: '', contact_name: '', email: '', phone: '', payment_terms: 'Net 30' })

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  async () => {
      const { data, error } = await inventoryAdvancedService.getAllSuppliers()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () => inventoryAdvancedService.createSupplier({
      name:           form.name!,
      contact_name:   form.contact_name ?? null,
      email:          form.email ?? null,
      phone:          form.phone ?? null,
      address:        null,
      payment_terms:  form.payment_terms ?? null,
      rating:         5.0,
      is_active:      true,
      notes:          null,
    }),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setShowModal(false)
      toast.success('Supplier added!')
    },
  })

  const ratingStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={10} className={i < Math.round(rating) ? 'text-gold-500 fill-gold-500' : 'text-gray-600'} />
    ))

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Truck size={18} className="text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Supplier Management</h3>
                <p className="text-xs text-gray-500 mt-0.5">{suppliers.length} active suppliers</p>
              </div>
            </div>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowModal(true)}>Add Supplier</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <SkeletonTable rows={4} /> : (
            <div className="space-y-3">
              {suppliers.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Truck size={18} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.contact_name ?? '—'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {ratingStars(s.rating)}
                      <span className="text-xs text-gray-500 ml-1">{s.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-500">{s.payment_terms}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.total_orders} orders</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <Phone size={13} />
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
              {suppliers.length === 0 && (
                <p className="text-center text-gray-500 py-6 text-sm">No suppliers added yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Supplier" size="sm">
        <div className="space-y-4">
          <Input label="Company Name *"   value={form.name ?? ''}          onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="ABC Supplies Ltd." />
          <Input label="Contact Name"     value={form.contact_name ?? ''}  onChange={e => setForm((p: any) => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" />
          <Input label="Email"            type="email" value={form.email ?? ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} placeholder="orders@supplier.com" prefix={<Mail size={13} />} />
          <Input label="Phone"            value={form.phone ?? ''}         onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" prefix={<Phone size={13} />} />
          <Input label="Payment Terms"    value={form.payment_terms ?? ''} onChange={e => setForm((p: any) => ({ ...p, payment_terms: e.target.value }))} placeholder="Net 30" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={createMutation.isPending} disabled={!form.name} onClick={() => createMutation.mutate()}>Add Supplier</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
