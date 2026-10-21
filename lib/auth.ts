import { getSupabaseClient } from './supabase'
import type { AuthUser, UserRole } from '@/types'

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signUp(email: string, password: string, metadata: Record<string, unknown> = {}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getSession() {
  const supabase = getSupabaseClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  return session
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staffRecord } = await supabase
    .from('staff')
    .select('*')
    .eq('user_id', user.id)
    .single() as any

  if (staffRecord) {
    return {
      id:      user.id,
      email:   user.email!,
      role:    staffRecord.role as UserRole,
      profile: staffRecord,
    }
  }

  const { data: customerRecord } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id)
    .single() as any

  if (customerRecord) {
    return {
      id:      user.id,
      email:   user.email!,
      role:    'customer',
      profile: customerRecord,
    }
  }

  return {
    id:      user.id,
    email:   user.email!,
    role:    'admin', // Changed to admin temporarily for testing
    profile: null,
  }
}

export async function resetPassword(email: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })
  if (error) throw new Error(error.message)
}

export async function updatePassword(newPassword: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}
