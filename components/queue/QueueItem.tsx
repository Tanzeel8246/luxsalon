'use client'
import { motion } from 'framer-motion'
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn, statusBadge } from '@/lib/utils'
import { useQueue } from '@/hooks/useQueue'
import { Badge } from '@/components/ui/Badge'
import type { QueueEntry } from '@/types'

interface QueueItemProps {
  entry:       QueueEntry
  showActions: boolean
}

export function QueueItem({ entry, showActions }: QueueItemProps) {
  const { updateStatus } = useQueue()

  const nextStatus: Record<string, QueueEntry['status'] | undefined> = {
    waiting: 'called',
    called:  'serving',
    serving: 'done',
  }

  const nextLabel: Record<string, string> = {
    waiting: 'Call',
    called:  'Serve',
    serving: 'Done',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8 hover:border-white/12 transition-colors"
    >
      <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-gold-400">#{entry.position}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {entry.customer?.name ?? 'Customer'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500 truncate">
            {entry.service?.name ?? 'Service'}
          </p>
          {entry.estimated_wait && (
            <span className="flex items-center gap-0.5 text-xs text-gray-600">
              <Clock size={9} />
              {entry.estimated_wait}m
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge className={statusBadge(entry.status)}>
          {entry.status}
        </Badge>
        {showActions && nextStatus[entry.status] && (
          <button
            onClick={() => updateStatus({ id: entry.id, status: nextStatus[entry.status]! })}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs',
              entry.status === 'serving'
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-gold-500/20 text-gold-400 hover:bg-gold-500/30'
            )}
          >
            {entry.status === 'serving' ? <CheckCircle size={13} /> : <Play size={13} />}
          </button>
        )}
        {entry.status === 'waiting' && (
          <button
            onClick={() => updateStatus({ id: entry.id, status: 'cancelled' })}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <XCircle size={13} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
