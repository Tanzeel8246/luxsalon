'use server'

import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'

export async function getAllUsers() {
  const supabase = createAdminSupabaseClient()
  
  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error fetching users:', error)
    throw new Error(error.message)
  }

  return users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.user_metadata?.role || 'customer',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))
}

export async function deleteUser(uid: string) {
  const supabase = createAdminSupabaseClient()
  
  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  // Delete user from auth
  const { error } = await supabase.auth.admin.deleteUser(uid)
  
  if (error) {
    console.error('Error deleting user:', error)
    throw new Error(error.message)
  }

  // Also try to delete from public users table if exists (cascade usually handles it but just in case)
  await supabase.from('users').delete().eq('id', uid)

  revalidatePath('/dashboard/admin')
  return { success: true }
}
