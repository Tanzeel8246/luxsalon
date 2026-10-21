'use client'
import { useState } from 'react'
import { Package, AlertTriangle, Plus, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn, formatCurrency } from '@/lib/utils'
import { useInventory } from '@/hooks/useInventory'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SkeletonTable } from '@/components/ui/Skeleton'

export function InventoryTable() {
  const { items, isLoading, restock } = useInventory()
  const [restockModal, setRestockModal] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [search, setSearch] = useState('')

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  )

  const handleRestock = () => {
    if (!restockModal || !restockQty) return
    restock({ id: restockModal, quantity: parseFloat(restockQty) })
    setRestockModal(null)
    setRestockQty('')
  }

  const stockLevel = (item: typeof items[0]) => {
    const pct = (item.quantity / item.min_threshold) * 100
    if (pct === 0)    return 'out'
    if (pct <= 50)    return 'critical'
    if (pct <= 100)   return 'warning'
    return 'ok'
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              prefix={<Package size={14} />}
            />
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} />
        ) : (
          <div className="space-y-2">
            {filtered.map((item, i) => {
              const level = stockLevel(item)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-colors"
                >
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    level === 'out'      ? 'bg-red-500' :
                    level === 'critical' ? 'bg-red-400 animate-pulse' :
                    level === 'warning'  ? 'bg-yellow-400' :
                    'bg-green-400'
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      {(level === 'critical' || level === 'out') && (
                        <AlertTriangle size={13} className="text-red-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.sku} · {item.category}</p>
                  </div>

                  <div className="text-right shrink-0 min-w-[80px]">
                    <p className={cn(
                      'text-sm font-semibold',
                      level === 'out' ? 'text-red-400' :
                      level === 'critical' ? 'text-red-300' :
                      level === 'warning'  ? 'text-yellow-400' :
                      'text-white'
                    )}>
                      {item.quantity} {item.unit}
                    </p>
                    <p className="text-xs text-gray-600">min: {item.min_threshold}</p>
                  </div>

                  <div className="text-right shrink-0 min-w-[60px]">
                    <p className="text-xs text-gray-400">{formatCurrency(item.cost_per_unit)}/{item.unit}</p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    icon={<RefreshCw size={12} />}
                    onClick={() => setRestockModal(item.id)}
                  >
                    Restock
                  </Button>
                </motion.div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-500 py-8">No items found.</p>
            )}
          </div>
        )}
      </div>

      <Modal
        open={!!restockModal}
        onClose={() => { setRestockModal(null); setRestockQty('') }}
        title="Restock Item"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Enter the quantity to add to stock.
          </p>
          <Input
            label="Quantity to add"
            type="number"
            min="0"
            step="0.01"
            value={restockQty}
            onChange={e => setRestockQty(e.target.value)}
            placeholder="e.g. 50"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRestockModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleRestock} disabled={!restockQty}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
