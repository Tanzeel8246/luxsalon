import { Header } from '@/components/layout/Header'
import { ShiftManager } from '@/components/scheduling/ShiftManager'
import { LeaveManager } from '@/components/scheduling/LeaveManager'

export default function SchedulingPage() {
  return (
    <>
      <Header title="Advanced Scheduling" subtitle="Shift manager · Leave requests · Recurring appointments · Group bookings · Resources" />
      <div className="p-6 space-y-6">
        <ShiftManager />
        <LeaveManager />
      </div>
    </>
  )
}
