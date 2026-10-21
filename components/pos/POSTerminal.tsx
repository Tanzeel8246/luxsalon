'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Trash2, CreditCard, Banknote, Wallet, Gift, Receipt, Calculator } from 'lucide-react'
import { posService } from '@/services/posService'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import toast from 'react-hot-toast'

interface CartItem {
  id:          string
  description: string
  quantity:    number
  unit_price:  number
}

interface POSTerminalProps {
  cashierId:    string
  customerId?:  string
  appointmentId?: string
  services?:    Array<{ id: string; name: string; price: number }>
}

const TAX_RATE = 0.08

export function POSTerminal({ cashierId, customerId, appointmentId, services = [] }: POSTerminalProps) {
  const [cart,          setCart]          = useState<CartItem[]>([])
  const [tipPct,        setTipPct]        = useState(0)
  const [discountPct,   setDiscountPct]   = useState(0)
  const [payMethod,     setPayMethod]     = useState<'cash' | 'card' | 'wallet' | 'gift_card' | 'split'>('card')
  const [giftCode,      setGiftCode]      = useState('')
  const [customItem,    setCustomItem]    = useState({ desc: '', price: '' })
  const [processing,    setProcessing]    = useState(false)
  const [receiptModal,  setReceiptModal]  = useState<string | null>(null)

  const subtotal   = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const discount   = subtotal * (discountPct / 100)
  const taxBase    = subtotal - discount
  const tax        = taxBase * TAX_RATE
  const tip        = taxBase * (tipPct / 100)
  const total      = taxBase + tax + tip

  const addService = (s: { id: string; name: string; price: number }) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === s.id)
      if (existing) return prev.map(i => i.id === s.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { id: s.id, description: s.name, quantity: 1, unit_price: s.price }]
    })
  }

  const addCustomItem = () => {
    if (!customItem.desc || !customItem.price) return
    const item: CartItem = {
      id:          `custom-${Date.now()}`,
      description: customItem.desc,
      quantity:    1,
      unit_price:  parseFloat(customItem.price),
    }
    setCart(prev => [...prev, item])
    setCustomItem({ desc: '', price: '' })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    )
  }

  const checkout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty')
    setProcessing(true)

    const { data, error } = await posService.createTransaction({
      appointment_id: appointmentId,
      customer_id:    customerId,
      cashier_id:     cashierId,
      items:          cart.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      payment_method: payMethod,
      tip_amount:     Math.round(tip * 100) / 100,
      discount_amount: Math.round(discount * 100) / 100,
    })

    setProcessing(false)

    if (error) return toast.error(error)
    const resData = data as any
    toast.success(`Payment complete — ${resData?.receipt_number}`)
    setReceiptModal(resData?.receipt_number ?? null)
    setCart([])
    setTipPct(0)
    setDiscountPct(0)
  }

  const payMethods = [
    { key: 'card',       label: 'Card',     icon: <CreditCard size={16} /> },
    { key: 'cash',       label: 'Cash',     icon: <Banknote size={16} /> },
    { key: 'wallet',     label: 'Wallet',   icon: <Wallet size={16} /> },
    { key: 'gift_card',  label: 'Gift',     icon: <Gift size={16} /> },
    { key: 'split',      label: 'Split',    icon: <Calculator size={16} /> },
  ] as const

  return (
    <>
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Service selector */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Services</h3>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {services.map(s => (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => addService(s)}
                className="p-3 rounded-xl border border-white/10 bg-white/3 hover:border-gold-500/30 hover:bg-gold-500/5 text-left transition-all"
              >
                <p className="text-xs font-medium text-white line-clamp-2">{s.name}</p>
                <p className="text-xs text-gold-400 font-semibold mt-1">{formatCurrency(s.price)}</p>
              </motion.button>
            ))}
          </div>

          {/* Custom item */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Custom Item</h3>
            <Input
              placeholder="Description"
              value={customItem.desc}
              onChange={e => setCustomItem(p => ({ ...p, desc: e.target.value }))}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Price"
                type="number"
                value={customItem.price}
                onChange={e => setCustomItem(p => ({ ...p, price: e.target.value }))}
              />
              <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addCustomItem}>Add</Button>
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Cart</h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                    Clear all
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="space-y-2 min-h-[80px]">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.description}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.unit_price)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md bg-white/8 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                          <Minus size={11} />
                        </button>
                        <span className="text-sm font-medium text-white w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, +1)} className="w-6 h-6 rounded-md bg-white/8 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                          <Plus size={11} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-white w-16 text-right shrink-0">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                      <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {cart.length === 0 && (
                  <p className="text-sm text-gray-600 text-center py-4">No items added</p>
                )}
              </div>

              {/* Modifiers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tip %</label>
                  <div className="flex gap-1">
                    {[0, 10, 15, 20].map(p => (
                      <button
                        key={p}
                        onClick={() => setTipPct(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tipPct === p ? 'bg-gold-500/20 text-gold-400 border border-gold-500/40' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                      >
                        {p === 0 ? 'No' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Discount %</label>
                  <div className="flex gap-1">
                    {[0, 5, 10, 20].map(p => (
                      <button
                        key={p}
                        onClick={() => setDiscountPct(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${discountPct === p ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                      >
                        {p === 0 ? 'No' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm border-t border-white/8 pt-3">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-400"><span>Discount ({discountPct}%)</span><span>−{formatCurrency(discount)}</span></div>}
                <div className="flex justify-between text-gray-400"><span>Tax (8%)</span><span>{formatCurrency(tax)}</span></div>
                {tip > 0 && <div className="flex justify-between text-gold-400"><span>Tip ({tipPct}%)</span><span>+{formatCurrency(tip)}</span></div>}
                <div className="flex justify-between font-bold text-white text-base border-t border-white/10 pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-gold-400">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Payment Method</p>
                <div className="flex gap-2 flex-wrap">
                  {payMethods.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setPayMethod(m.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        payMethod === m.key
                          ? 'bg-gold-500/20 border-gold-500/50 text-gold-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                {payMethod === 'gift_card' && (
                  <div className="mt-2">
                    <Input
                      placeholder="Gift card code (e.g. ABC1-DEF2-GHI3)"
                      value={giftCode}
                      onChange={e => setGiftCode(e.target.value.toUpperCase())}
                      prefix={<Gift size={14} />}
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                loading={processing}
                disabled={cart.length === 0}
                icon={<Receipt size={16} />}
                onClick={checkout}
              >
                Charge {formatCurrency(total)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipt modal */}
      <Modal open={!!receiptModal} onClose={() => setReceiptModal(null)} title="Payment Successful" size="sm">
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
            <Receipt size={28} className="text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{formatCurrency(total)}</p>
            <p className="text-sm text-gray-400 mt-1">Receipt: {receiptModal}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setReceiptModal(null)}>Close</Button>
            <Button className="flex-1" icon={<Receipt size={14} />} onClick={() => {}}>Print</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
