import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { QueueBoard } from '@/components/queue/QueueBoard'

export default function QueuePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-obsidian-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header title="Live Queue" subtitle="Real-time queue management" />
        <div className="p-6">
          <QueueBoard />
        </div>
      </main>
    </div>
  )
}
