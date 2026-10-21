'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { queueService } from '@/services/queueService'

export function useQueue() {
  const qc = useQueryClient()

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn:  async () => {
      const { data, error } = await queueService.getActiveQueue()
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 30000,
  })

  const { data: stats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn:  async () => {
      const { data, error } = await queueService.getQueueStats()
      if (error) throw new Error(error)
      return data
    },
    refetchInterval: 30000,
  })

  useEffect(() => {
    const subscription = queueService.subscribeToQueue(() => {
      qc.invalidateQueries({ queryKey: ['queue'] })
      qc.invalidateQueries({ queryKey: ['queue-stats'] })
    })
    return () => { subscription.unsubscribe() }
  }, [qc])

  const addToQueueMutation = useMutation({
    mutationFn: queueService.addToQueue,
    onSuccess:  (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['queue'] })
      toast.success(`Added to queue — position #${result.data?.position}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Parameters<typeof queueService.updateStatus>[1] }) =>
      queueService.updateStatus(id, status),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['queue'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const callNextMutation = useMutation({
    mutationFn: queueService.callNext,
    onSuccess:  (result) => {
      if (result.error) { toast.error(result.error); return }
      if (!result.data) { toast('No one in queue'); return }
      qc.invalidateQueries({ queryKey: ['queue'] })
      toast.success(`Calling ${result.data.customer?.name ?? 'customer'}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return {
    queue,
    stats,
    isLoading,
    addToQueue:    addToQueueMutation.mutate,
    updateStatus:  updateStatusMutation.mutate,
    callNext:      callNextMutation.mutate,
    isAdding:      addToQueueMutation.isPending,
    isCalling:     callNextMutation.isPending,
  }
}
