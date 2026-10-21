'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { inventoryService } from '@/services/inventoryService'

export function useInventory() {
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn:  async () => {
      const { data, error } = await inventoryService.getAll()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn:  async () => {
      const { data, error } = await inventoryService.getLowStockAlerts()
      if (error) throw new Error(error)
      return data ?? []
    },
    refetchInterval: 60000,
  })

 useEffect(() => {
  // Realtime subscription optional — polling handles updates
  // Enable Supabase Realtime on inventory table to activate
  try {
    const subscription = inventoryService.subscribeToAlerts(() => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
    })
    return () => {
      try { subscription.unsubscribe() } catch {}
    }
  } catch {
    return () => {}
  }
}, [qc])

  const restockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      inventoryService.restock(id, quantity),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
      toast.success('Stock updated successfully.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: inventoryService.create,
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Item added to inventory.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof inventoryService.update>[1] }) =>
      inventoryService.update(id, updates),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Item updated.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts  = alerts.filter(a => a.severity === 'warning')

  return {
    items,
    alerts,
    criticalAlerts,
    warningAlerts,
    isLoading,
    restock:    restockMutation.mutate,
    addItem:    createMutation.mutate,
    updateItem: updateMutation.mutate,
  }
}
