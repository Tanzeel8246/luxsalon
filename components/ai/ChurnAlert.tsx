'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Send, CheckCircle, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { aiService } from '@/services/aiService'
import { marketingService } from '@/services/marketingService'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

const riskConfig = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',   dot: 'bg-red-500',    label: 'Critical' },
  high:     { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-500', label: 'High' },
  medium:   { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-500', label: 'Medium' },
  low:      { color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/20',  dot: 'bg-gray-500',   label: 'Low' },
}

export function ChurnAlert() {
  const qc = useQueryClient()

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ['churn-predictions'],
    queryFn:  async () => {
      const { data, error } = await aiService.getChurnPredictions()
      if (error) throw new Error(error)
      return data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })

  const winbackMutation = useMutation({
    mutationFn: async ({ predId, customerId }: { predId: string; customerId: string }) => {
      await marketingService.sendChurnWinback(customerId)
      await aiService.markChurnActionTaken(predId, 'winback_whatsapp')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['churn-predictions'] })
      toast.success('Win-back message sent!')
    },
    onError: () => toast.error('Failed to send message'),
  })

  const critical = predictions.filter(p => p.risk_level === 'critical').length
  const high     = predictions.filter(p => p.risk_level === 'high').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/15 border border-red-500/20">
              <TrendingDown size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Churn Detection</h3>
              <p className="text-xs text-gray-500">AI-powered at-risk customers</p>
            </div>
          </div>
          <div className="flex gap-2">
            {critical > 0 && (
              <span className="px-2 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-bold">
                {critical} Critical
              </span>
            )}
            {high > 0 && (
              <span className="px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 text-xs font-bold">
                {high} High
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : predictions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No churn risk detected!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {predictions.slice(0, 10).map((pred, i) => {
              const cfg = (riskConfig as any)[pred.risk_level] || riskConfig.low
              return (
                <motion.div
                  key={pred.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn('flex items-center gap-3 p-3 rounded-xl border', cfg.bg)}
                >
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 animate-pulse', cfg.dot)} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {pred.customer?.name ?? 'Customer'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last visit: {pred.days_since_visit} days ago
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5 mb-1">
                      <span className={cn('text-xs font-bold', cfg.color)}>
                        {(pred.churn_score * 100).toFixed(0)}%
                      </span>
                      <Badge className={cn('text-xs border-current border bg-transparent', cfg.color)}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Send size={11} />}
                      className="text-xs py-1 px-2"
                      loading={winbackMutation.isPending}
                      onClick={() => winbackMutation.mutate({
                        predId:     pred.id,
                        customerId: pred.customer_id,
                      })}
                    >
                      Win-back
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
