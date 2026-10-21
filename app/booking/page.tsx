import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function BookingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: customer } = await (supabase as any)
    .from('customers')
    .select('id')
    .eq('user_id', session.user.id)
    .single() as any

  if (!customer) redirect('/dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-obsidian-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header title="Book Appointment" subtitle="Multi-step smart booking" />
        <div className="p-6">
          <BookingWizard customerId={customer.id} />
        </div>
      </main>
    </div>
  )
}
