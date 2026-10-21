'use client'
import { Header } from '@/components/layout/Header'
import { SystemHealthPanel } from '@/components/performance/SystemHealth'
import { IntegrationsPanel } from '@/components/integrations/IntegrationsPanel'
import { IntegrationSettings } from '@/components/admin/IntegrationSettings'
import { ReportGenerator } from '@/components/admin/ReportGenerator'
import { useState } from 'react'
import { Settings2, Activity, Link, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'health' | 'integrations' | 'api-keys' | 'reports'

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'health',       label: 'System Health',  icon: Activity   },
  { id: 'integrations', label: 'Integrations',   icon: Link       },
  { id: 'api-keys',     label: 'API Keys & AI',  icon: Settings2  },
  { id: 'reports',      label: 'Reports',        icon: FileText   },
]

export default function SystemPage() {
  const [tab, setTab] = useState<Tab>('health')

  return (
    <>
      <Header title="System & Integrations" subtitle="Performance monitoring · Health check · API Keys · Reports" />
      <div className="p-6 space-y-6">

        {/* Tab navigation */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-white/3 border border-white/8 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === t.id
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'health'       && <SystemHealthPanel />}
        {tab === 'integrations' && <IntegrationsPanel />}
        {tab === 'api-keys'     && <IntegrationSettings />}
        {tab === 'reports'      && <ReportGenerator />}

      </div>
    </>
  )
}
