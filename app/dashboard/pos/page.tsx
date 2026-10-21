import { Header } from '@/components/layout/Header'
import { POSTerminal } from '@/components/pos/POSTerminal'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

export default async function POSPage() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: staff } = await (supabase as any)
    .from('staff')
    .select('id')
    .eq('user_id', session.user.id)
    .single() as any

  const { data: services } = await (supabase as any)
    .from('services')
    .select('id, name, base_price')
    .eq('is_active', true) as any

  if (!staff) redirect('/dashboard')

  return (
    <>
      <Header title="POS Terminal" subtitle="Point of Sale · Invoicing · Payments" />
      <div className="p-6">
        <POSTerminal
          cashierId={staff.id}
          services={(services ?? []).map((s: any) => ({ id: s.id, name: s.name, price: s.base_price }))}
        />
      </div>
    </>
  )
}
