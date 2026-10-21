import { Header } from '@/components/layout/Header'
import { WaitlistManager } from '@/components/customer/WaitlistManager'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Smartphone, QrCode, Palette, Globe } from 'lucide-react'

export default function ExperiencePage() {
  return (
    <>
      <Header title="Customer Experience" subtitle="Waitlist · Self check-in kiosk · Virtual try-on · Public booking · Queue TV" />
      <div className="p-6 space-y-6">

        {/* Feature cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Globe size={18} />,      label: 'Public Booking',    desc: 'No login required',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
            { icon: <QrCode size={18} />,     label: 'Self Check-in',     desc: 'Kiosk at entrance',    color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
            { icon: <Palette size={18} />,    label: 'Virtual Try-on',    desc: 'AI hairstyle preview', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { icon: <Smartphone size={18} />, label: 'Queue TV Display',  desc: 'Live board on screen', color: 'text-gold-400',   bg: 'bg-gold-500/10 border-gold-500/20' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-xl border ${s.bg}`}>
              <div className={`mb-2 ${s.color}`}>{s.icon}</div>
              <p className="text-sm font-semibold text-white">{s.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>

        <WaitlistManager />

        {/* Kiosk config preview */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-white">Self Check-in Kiosk</h3>
            <p className="text-xs text-gray-500 mt-0.5">QR code scan → auto queue → push notification</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 rounded-xl border border-gold-500/30 bg-gold-500/5 flex items-center justify-center">
                <QrCode size={48} className="text-gold-400" />
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                  <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center text-obsidian-950 font-bold text-xs">1</div>
                  <p className="text-sm text-gray-300">Customer scans QR code at salon entrance</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                  <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center text-obsidian-950 font-bold text-xs">2</div>
                  <p className="text-sm text-gray-300">System finds appointment, auto check-in</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                  <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center text-obsidian-950 font-bold text-xs">3</div>
                  <p className="text-sm text-gray-300">Queue position assigned, wait time shown on TV</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                  <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center text-obsidian-950 font-bold text-xs">4</div>
                  <p className="text-sm text-gray-300">WhatsApp notification when their turn arrives</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
