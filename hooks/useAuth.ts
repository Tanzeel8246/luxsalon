'use client'
import { useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCurrentUser, signIn, signOut, signUp } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import type { AuthUser } from '@/types'

interface AuthState {
  user:    AuthUser | null
  setUser: (u: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:    null,
      setUser: (user) => set({ user }),
    }),
    { name: 'auth-store' }
  )
)

export function useAuth() {
  const qc     = useQueryClient()
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const { isLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn:  async () => {
      const u = await getCurrentUser()
      setUser(u)
      return u
    },
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    const supabase = getSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        qc.clear()
        router.push('/auth/login')
      } else if (event === 'SIGNED_IN') {
        const u = await getCurrentUser()
        setUser(u)
        qc.invalidateQueries({ queryKey: ['auth-user'] })
      }
    })
    return () => subscription.unsubscribe()
  }, [setUser, qc, router])

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
    onSuccess: async () => {
      const u = await getCurrentUser()
      setUser(u)
      toast.success('Welcome back!')
      router.push('/dashboard')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess:  () => {
      setUser(null)
      qc.clear()
      router.push('/auth/login')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const registerMutation = useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      signUp(email, password, { name }),
    onSuccess: () => {
      toast.success('Account created! Please check your email.')
      router.push('/auth/login')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isAdmin    = user?.role === 'admin'
  const isStaff    = user?.role === 'staff' || user?.role === 'admin'
  const isCustomer = user?.role === 'customer'

  return {
    user,
    isLoading,
    isAdmin,
    isStaff,
    isCustomer,
    login:    loginMutation.mutate,
    logout:   logoutMutation.mutate,
    register: registerMutation.mutate,
    loginPending:    loginMutation.isPending,
    logoutPending:   logoutMutation.isPending,
    registerPending: registerMutation.isPending,
  }
}
