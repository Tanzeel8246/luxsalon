'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Download, Brain, Loader2, CheckCircle,
  TrendingUp, Users, DollarSign, Star
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase'
import { getGeminiClient } from '@/lib/gemini'
import toast from 'react-hot-toast'

type ReportType = 'revenue' | 'staff' | 'customers' | 'inventory' | 'complete'
type ReportPeriod = '7' | '30' | '90'

const REPORT_TYPES = [
  { id: 'revenue'   as ReportType, label: 'Revenue Report',      icon: DollarSign, color: 'text-gold-400',   bg: 'bg-gold-500/10'   },
  { id: 'staff'     as ReportType, label: 'Staff Performance',   icon: Star,       color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  { id: 'customers' as ReportType, label: 'Customer Analysis',   icon: Users,      color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'inventory' as ReportType, label: 'Inventory Status',    icon: TrendingUp, color: 'text-green-400',  bg: 'bg-green-500/10'  },
  { id: 'complete'  as ReportType, label: 'Complete Report',     icon: FileText,   color: 'text-white',      bg: 'bg-white/10'      },
]

async function gatherReportData(type: ReportType, days: number) {
  const supabase = getSupabaseClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const data: Record<string, any> = {}

  if (type === 'revenue' || type === 'complete') {
    const { data: appts } = await supabase
      .from('appointments')
      .select('total_price, status, start_time')
      .gte('start_time', since)
    data.appointments = appts ?? []
    data.total_revenue = (appts ?? []).filter((a: any) => a.status === 'completed')
      .reduce((s: number, a: any) => s + (a.total_price ?? 0), 0)
    data.total_bookings = (appts ?? []).length
    data.completed = (appts ?? []).filter((a: any) => a.status === 'completed').length
  }

  if (type === 'staff' || type === 'complete') {
    const { data: staff } = await supabase
      .from('staff')
      .select('name, role, rating, completed_appointments, is_active')
    data.staff = staff ?? []
  }

  if (type === 'customers' || type === 'complete') {
    const { data: customers } = await supabase
      .from('customers')
      .select('name, total_visits, total_spent, loyalty_tier')
      .order('total_spent', { ascending: false })
      .limit(20)
    data.top_customers = customers ?? []
  }

  if (type === 'inventory' || type === 'complete') {
    const { data: inv } = await supabase
      .from('inventory')
      .select('name, quantity, reorder_level, cost_price, selling_price')
    data.inventory = inv ?? []
    data.low_stock = (inv ?? []).filter((i: any) => i.quantity <= i.reorder_level)
  }

  return data
}

function exportCSV(data: Record<string, any>, type: ReportType, days: number) {
  let csv = `LuxSalon ${type.toUpperCase()} Report - Last ${days} days\n\n`

  if (data.appointments) {
    csv += 'Revenue Summary\nTotal Revenue,Total Bookings,Completed\n'
    csv += `${formatCurrency(data.total_revenue)},${data.total_bookings},${data.completed}\n\n`
  }

  if (data.staff) {
    csv += 'Staff Performance\nName,Role,Rating,Appointments\n'
    data.staff.forEach((s: any) => {
      csv += `${s.name},${s.role},${s.rating},${s.completed_appointments ?? 0}\n`
    })
    csv += '\n'
  }

  if (data.top_customers) {
    csv += 'Top Customers\nName,Total Visits,Total Spent,Tier\n'
    data.top_customers.forEach((c: any) => {
      csv += `${c.name},${c.total_visits ?? 0},${formatCurrency(c.total_spent ?? 0)},${c.loyalty_tier ?? 'bronze'}\n`
    })
    csv += '\n'
  }

  if (data.inventory) {
    csv += 'Inventory\nName,Quantity,Reorder Level,Status\n'
    data.inventory.forEach((i: any) => {
      const status = i.quantity <= i.reorder_level ? 'LOW STOCK' : 'OK'
      csv += `${i.name},${i.quantity},${i.reorder_level},${status}\n`
    })
  }

  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `luxsalon-${type}-report-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportGenerator() {
  const [selectedType, setSelectedType] = useState<ReportType>('complete')
  const [period,       setPeriod]       = useState<ReportPeriod>('30')
  const [loading,      setLoading]      = useState(false)
  const [aiSummary,    setAiSummary]    = useState<string | null>(null)
  const [generated,    setGenerated]    = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setAiSummary(null)
    setGenerated(false)

    try {
      const data = await gatherReportData(selectedType, parseInt(period))

      // Try AI Summary
      const gemini = await getGeminiClient()
      if (gemini) {
        try {
          const prompt = `You are a business analyst for LuxSalon. Analyze this salon data from the last ${period} days and provide a concise business summary (3-5 paragraphs) with key insights, what's working well, and what needs improvement. Use professional tone. Data: ${JSON.stringify(data, null, 2)}`
          const response = await gemini.models.generateContent({
            model:    'gemini-2.5-flash',
            contents: prompt,
          })
          setAiSummary(response.text || null)
        } catch (err) {
          console.error('AI summary failed:', err)
          setAiSummary('⚠️ AI summary could not be generated. You can still export the CSV report.')
        }
      } else {
        setAiSummary('ℹ️ Gemini API key not configured. Add your API key in settings to get AI-powered report summaries. CSV export is still available.')
      }

      // Auto-export CSV
      exportCSV(data, selectedType, parseInt(period))
      setGenerated(true)
      toast.success('Report generated and downloaded!')
    } catch (err: any) {
      toast.error('Failed to generate report: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
            <FileText size={18} className="text-gold-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Report Generator</h3>
            <p className="text-xs text-gray-500">AI-powered analytics & CSV export</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Report Type Selection */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">رپورٹ کی قسم:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.id}
                onClick={() => setSelectedType(rt.id)}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${
                  selectedType === rt.id
                    ? 'border-gold-500/50 bg-gold-500/10 text-white'
                    : 'border-white/8 bg-white/3 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                <rt.icon size={13} className={selectedType === rt.id ? 'text-gold-400' : rt.color} />
                <span className="font-medium">{rt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Period */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">عرصہ:</p>
          <div className="flex gap-2">
            {(['7', '30', '90'] as ReportPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  period === p
                    ? 'border-gold-500/50 bg-gold-500/10 text-gold-400'
                    : 'border-white/8 bg-white/3 text-gray-400 hover:text-white'
                }`}
              >
                آخری {p} دن
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full gap-2"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> رپورٹ بنائی جا رہی ہے...</>
          ) : generated ? (
            <><CheckCircle size={14} /> دوبارہ جنریٹ کریں</>
          ) : (
            <><Download size={14} /> رپورٹ جنریٹ کریں</>
          )}
        </Button>

        {/* AI Summary */}
        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-purple-400" />
              <p className="text-xs font-semibold text-purple-400">AI Business Summary</p>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{aiSummary}</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
