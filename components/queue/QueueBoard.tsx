'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Play, CheckCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'
import { useQueue } from '@/hooks/useQueue'
import { QueueItem } from './QueueItem'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { SkeletonTable } from '@/components/ui/Skeleton'

export function QueueBoard() {
  const { queue, stats, isLoading, callNext, isCalling } = useQueue()

  const waiting = queue.filter(e => e.status === 'waiting')
  const called  = queue.filter(e => e.status === 'called')
  const serving = queue.filter(e => e.status === 'serving')

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'In Queue',     value: stats.queue_length },
            { label: 'Active Staff', value: stats.active_staff },
            { label: 'Avg Duration', value: `${formatDuration(Math.round(stats.avg_duration))}` },
            { label: 'Est. Wait',    value: `${Math.ceil(stats.estimated_wait)}m` },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-obsidian-950/60 px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Waiting */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <h3 className="font-semibold text-white text-sm">Waiting</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">{waiting.length}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={isCalling}
                icon={<Bell size={13} />}
                onClick={() => callNext()}
              >
                Call Next
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 min-h-[200px]">
            {isLoading && <SkeletonTable rows={3} />}
            <AnimatePresence>
              {waiting.map(entry => (
                <QueueItem key={entry.id} entry={entry} showActions />
              ))}
            </AnimatePresence>
            {!isLoading && waiting.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">Queue is empty</p>
            )}
          </CardContent>
        </Card>

        {/* Called */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="font-semibold text-white text-sm">Called</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">{called.length}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 min-h-[200px]">
            <AnimatePresence>
              {called.map(entry => (
                <QueueItem key={entry.id} entry={entry} showActions />
              ))}
            </AnimatePresence>
            {called.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No customers called</p>
            )}
          </CardContent>
        </Card>

        {/* Serving */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <h3 className="font-semibold text-white text-sm">In Service</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">{serving.length}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 min-h-[200px]">
            <AnimatePresence>
              {serving.map(entry => (
                <QueueItem key={entry.id} entry={entry} showActions />
              ))}
            </AnimatePresence>
            {serving.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No active services</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
