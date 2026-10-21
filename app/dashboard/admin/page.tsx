'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ToggleLeft, ToggleRight, Trash2, ShieldAlert } from 'lucide-react'
import { pricingService } from '@/services/pricingService'
import { staffService } from '@/services/staffService'
import { getAllUsers, deleteUser } from '@/app/actions/admin'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { PricingRule, Staff } from '@/types'

export default function AdminPage() {
  const qc = useQueryClient()

  const { data: rules = [] } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn:  async () => {
      const { data, error } = await pricingService.getAllRules() as { data: PricingRule[] | null; error: string | null }
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'],
    queryFn:  async () => {
      const { data, error } = await staffService.getAll()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  () => getAllUsers(),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (uid: string) => deleteUser(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User account permanently deleted.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDeleteUser = (uid: string) => {
    if (confirm('Are you sure you want to completely delete this user account? This action cannot be undone.')) {
      deleteUserMutation.mutate(uid)
    }
  }

  const toggleRule = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      pricingService.toggleRule(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-rules'] })
      toast.success('Rule updated.')
    },
  })

  const toggleStaff = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      staffService.update(id, { is_active: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-all'] })
      toast.success('Staff updated.')
    },
  })

  const ruleTypeBadge: Record<string, string> = {
    peak_hours: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    demand:     'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    seasonal:   'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    loyalty:    'bg-gold-500/20 text-gold-400 border border-gold-500/30',
    promo:      'bg-green-500/20 text-green-400 border border-green-500/30',
  }

  return (
    <>
      <Header title="Admin Panel" subtitle="System configuration & management" />
      <div className="p-6 grid lg:grid-cols-2 gap-6">
        {/* Pricing Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Pricing Rules</h2>
                <p className="text-xs text-gray-500 mt-0.5">Dynamic pricing engine</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No pricing rules configured.</p>
            )}
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/3 border border-white/8">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{rule.name}</p>
                    <Badge className={ruleTypeBadge[rule.rule_type] ?? 'bg-gray-500/20 text-gray-400'}>
                      {rule.rule_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Multiplier: ×{rule.multiplier}
                  </p>
                </div>
                <button
                  onClick={() => toggleRule.mutate({ id: rule.id, active: !rule.is_active })}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {rule.is_active
                    ? <ToggleRight size={24} className="text-gold-400" />
                    : <ToggleLeft size={24} />
                  }
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Staff Management */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white">Staff Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">{staff.length} active staff members</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {staff.map(member => (
              <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/3 border border-white/8">
                <div className="w-9 h-9 rounded-full bg-gold-500/15 border border-gold-500/20 flex items-center justify-center shrink-0">
                  <span className="text-gold-400 text-sm font-semibold">{member.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.role} · ★{member.rating.toFixed(1)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={member.is_active
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <button
                    onClick={() => toggleStaff.mutate({ id: member.id, active: !member.is_active })}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {member.is_active
                      ? <ToggleRight size={22} className="text-gold-400" />
                      : <ToggleLeft size={22} />
                    }
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        {/* User Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-400">
              <ShieldAlert size={20} />
              <h2 className="text-base font-semibold text-white">System Users (Danger Zone)</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{users.length} registered accounts across the platform</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/8 text-gray-500 font-medium">
                    <th className="pb-3 px-2">Email</th>
                    <th className="pb-3 px-2">Role</th>
                    <th className="pb-3 px-2">Created</th>
                    <th className="pb-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u: any) => (
                    <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-white">{u.email}</td>
                      <td className="py-3 px-2">
                        <Badge className={
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                          u.role === 'staff' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteUser(u.id)}
                          className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
