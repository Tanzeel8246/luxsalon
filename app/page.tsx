import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

export default async function RootPage() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  redirect(session ? '/dashboard' : '/auth/login')
}
