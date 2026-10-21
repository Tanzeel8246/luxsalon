import { Header } from '@/components/layout/Header'
import { AuditLogPanel } from '@/components/security/AuditLog'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Shield, Lock, UserX, FileSearch } from 'lucide-react'

export default function SecurityPage() {
  return (
    <>
      <Header title="Security & Compliance" subtitle="Audit logs · 2FA · GDPR · Suspicious activity · IP whitelist" />
      <div className="p-6 space-y-6">

        {/* Security Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Shield size={18} />,    label: 'Security Score',   value: '94/100',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
            { icon: <Lock size={18} />,      label: '2FA Enabled',      value: '7 Staff',  color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' },
            { icon: <UserX size={18} />,     label: 'Blocked IPs',      value: '0',        color: 'text-gray-400',  bg: 'bg-gray-500/10 border-gray-500/15' },
            { icon: <FileSearch size={18} />,label: 'GDPR Requests',    value: '2 Pending', color: 'text-gold-400', bg: 'bg-gold-500/10 border-gold-500/20' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-xl border ${s.bg}`}>
              <div className={`mb-2 ${s.color}`}>{s.icon}</div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <AuditLogPanel />
      </div>
    </>
  )
}
