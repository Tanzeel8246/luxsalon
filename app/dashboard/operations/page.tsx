import { Header } from '@/components/layout/Header'
import { TaskBoard } from '@/components/operations/TaskBoard'
import { SOPChecklist } from '@/components/operations/SOPChecklist'
import { TrainingCenter } from '@/components/operations/TrainingCenter'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

export default async function OperationsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: staff } = await (supabase as any)
    .from('staff').select('id').eq('user_id', session.user.id).single() as any

  if (!staff) redirect('/dashboard')

  return (
    <>
      <Header title="Operations Management" subtitle="Task board · SOP checklists · Incident reporting · Training center" />
      <div className="p-6 space-y-6">
        <TaskBoard />
        <div className="grid lg:grid-cols-2 gap-6">
          <SOPChecklist staffId={staff.id} />
          <TrainingCenter staffId={staff.id} />
        </div>
      </div>
    </>
  )
}
