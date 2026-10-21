'use client'
import { AlertTriangle, AlertOctagon } from 'lucide-react'
import { useInventory } from '@/hooks/useInventory'
import { cn } from '@/lib/utils'

export function LowStockAlert() {
  const { criticalAlerts, warningAlerts } = useInventory()

  if (criticalAlerts.length === 0 && warningAlerts.length === 0) return null

  return (
    <div className="space-y-2">
      {criticalAlerts.map(alert => (
        <div
          key={alert.item.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <AlertOctagon size={16} className="text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">{alert.item.name}</p>
            <p className="text-xs text-red-400/80">
              {alert.item.quantity === 0 ? 'Out of stock' : `Only ${alert.item.quantity} ${alert.item.unit} remaining`}
            </p>
          </div>
        </div>
      ))}
      {warningAlerts.map(alert => (
        <div
          key={alert.item.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
        >
          <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-300">{alert.item.name}</p>
            <p className="text-xs text-yellow-400/80">
              {alert.item.quantity} {alert.item.unit} remaining (min: {alert.item.min_threshold})
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
