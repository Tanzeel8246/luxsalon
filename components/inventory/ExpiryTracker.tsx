'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { differenceInDays, parseISO } from 'date-fns'
import { Clock, AlertTriangle, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { inventoryAdvancedService } from '@/services/inventoryAdvancedService'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

export function ExpiryTracker() {
  const qc = useQueryClient()

  const { data: expiring = [] } = useQuery({
    queryKey: ['inventory-expiring'],
    queryFn:  async () => {
      const { data, error } = await inventoryAdvancedService.getExpiringItems(30)
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 60 * 60 * 1000,
  })

  const { data: expired = [] } = useQuery({
    queryKey: ['inventory-expired'],
    queryFn:  async () => {
      const { data, error } = await inventoryAdvancedService.getExpiredItems()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const disposeMutation = useMutation({
    mutationFn: (id: string) => inventoryAdvancedService.disposeExpiredItem(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['inventory-expired'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Item disposed and stock deducted.')
    },
  })

  const allItems = [
    ...expired.map(i => ({ ...i, isExpired: true })),
    ...expiring.map(i => ({ ...i, isExpired: false })),
  ]

  const daysUntilExpiry = (date: string) => differenceInDays(parseISO(date), new Date())

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Clock size={18} className="text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Expiry Tracking</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {expired.length} expired · {expiring.length} expiring within 30 days
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {allItems.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">No expiry concerns — all stock is fresh!</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {allItems.map((item, i) => {
              const days   = daysUntilExpiry(item.expiry_date)
              const urgent = item.isExpired || days <= 7
              return (
                <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    item.isExpired
                      ? 'border-red-500/30 bg-red-500/5'
                      : days <= 7
                        ? 'border-orange-500/30 bg-orange-500/5'
                        : 'border-yellow-500/25 bg-yellow-500/4'
                  )}>
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', item.isExpired ? 'bg-red-500 animate-pulse' : days <= 7 ? 'bg-orange-500 animate-pulse' : 'bg-yellow-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {(item as { inventory?: { name?: string } }).inventory?.name ?? 'Unknown Item'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{item.quantity} units</span>
                      <span className="text-xs text-gray-500">Batch: {item.batch_number ?? 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-xs font-bold', item.isExpired ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-yellow-400')}>
                      {item.isExpired ? 'EXPIRED' : `${days}d left`}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(item.expiry_date)}</p>
                  </div>
                  {item.isExpired && (
                    <Button size="sm" variant="danger" icon={<Trash2 size={11} />}
                      loading={disposeMutation.isPending}
                      onClick={() => disposeMutation.mutate(item.id)}>
                      Dispose
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
