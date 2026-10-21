'use client'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title:    string
  value:    string | number
  change?:  number
  icon:     React.ReactNode
  subtitle?: string
  delay?:   number
}

export function StatsCard({ title, value, change, icon, subtitle, delay = 0 }: StatsCardProps) {
  const isPositive = (change ?? 0) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl border border-white/8 bg-obsidian-950/60 p-5 hover:border-gold-500/20 transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 group-hover:bg-gold-500/20 transition-colors">
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            isPositive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          )}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-400">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </motion.div>
  )
}
