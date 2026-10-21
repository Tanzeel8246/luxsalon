'use client'
import { Bell, Search } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from './ThemeToggle'
import { useInventory } from '@/hooks/useInventory'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title?:    string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const { criticalAlerts, warningAlerts } = useInventory()

  const totalAlerts = criticalAlerts.length + warningAlerts.length

  return (
    <header className="h-16 border-b border-white/8 bg-obsidian-950/80 backdrop-blur-sm px-6 flex items-center justify-between shrink-0">
      <div>
        {title    && <h1 className="text-lg font-semibold text-white">{title}</h1>}
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search..."
            className="w-48 pl-9 pr-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Bell size={18} />
            {totalAlerts > 0 && (
              <span className={cn(
                'absolute top-1 right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center',
                criticalAlerts.length > 0 ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
              )}>
                {totalAlerts > 9 ? '9+' : totalAlerts}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-obsidian-900 border border-white/10 shadow-xl z-50"
              >
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {totalAlerts === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-500 text-center">All clear</p>
                  )}
                  {criticalAlerts.map(alert => (
                    <div key={alert.item.id} className="px-4 py-3 flex gap-3 items-start border-b border-white/5 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-white font-medium">{alert.item.name}</p>
                        <p className="text-xs text-red-400">Critical: {alert.item.quantity} {alert.item.unit} left</p>
                      </div>
                    </div>
                  ))}
                  {warningAlerts.map(alert => (
                    <div key={alert.item.id} className="px-4 py-3 flex gap-3 items-start border-b border-white/5 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-white font-medium">{alert.item.name}</p>
                        <p className="text-xs text-yellow-400">Low: {alert.item.quantity} {alert.item.unit} remaining</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ThemeToggle />
      </div>
    </header>
  )
}
