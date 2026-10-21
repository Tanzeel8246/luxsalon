'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle, Clock, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { customerExperienceService } from '@/services/customerExperienceService'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

export function WaitlistManager() {
  const qc = useQueryClient()

  const { data: waitlist = [], isLoading } = useQuery({
    queryKey: ['waitlist'],
    queryFn:  async () => {
      const { data, error } = await customerExperienceService.getWaitlist()
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 30000,
  })

  const notifyMutation = useMutation({
    mutationFn: (id: string) => customerExperienceService.notifyWaitlist(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success('Customer notified!')
    },
  })

  const channelIcons: Record<string, string> = {
    whatsapp: '💬', sms: '📱', email: '📧', push: '🔔',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Bell size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Waitlist</h3>
              <p className="text-xs text-gray-500 mt-0.5">{waitlist.length} customers waiting for a slot</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => notifyMutation.mutate('check')} icon={<Bell size={13} />}>
            Check Slots
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <SkeletonTable rows={3} /> : waitlist.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Waitlist is empty</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {waitlist.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-colors">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                  <span className="text-blue-400 font-bold text-sm">{entry.customer?.name?.charAt(0) ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{entry.customer?.name ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">{entry.service?.name ?? '—'}</p>
                    {entry.preferred_date && (
                      <span className="text-xs text-gray-600">· {formatDate(entry.preferred_date)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span title={`Notify via ${entry.notify_via}`} className="text-base">
                    {channelIcons[entry.notify_via]}
                  </span>
                  <Badge className="bg-blue-500/12 text-blue-400 border border-blue-500/25 text-xs">
                    <Clock size={9} /> waiting
                  </Badge>
                  <Button size="sm" icon={<Bell size={11} />}
                    loading={notifyMutation.isPending}
                    onClick={() => notifyMutation.mutate(entry.id)}>
                    Notify
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
