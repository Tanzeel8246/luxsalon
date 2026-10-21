'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Sun, Moon, Clock, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { schedulingService } from '@/services/schedulingService'
import { staffService } from '@/services/staffService'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
// import type { StaffShift } from '@/types'

const SHIFT_CONFIG = {
  morning: { label: 'Morning',  icon: <Sun size={12} />,      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', time: '9:00–14:00' },
  evening: { label: 'Evening',  icon: <Moon size={12} />,     color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     time: '14:00–20:00' },
  full:    { label: 'Full Day', icon: <Clock size={12} />,    color: 'bg-green-500/15 text-green-400 border-green-500/30',  time: '9:00–20:00' },
  off:     { label: 'Off',      icon: <XCircle size={12} />,  color: 'bg-gray-500/15 text-gray-500 border-gray-500/20',     time: 'Day off' },
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ShiftManager() {
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))

  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd'))

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'],
    queryFn:  async () => {
      const { data, error } = await staffService.getAll()
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', weekStart],
    queryFn:  async () => {
      const { data, error } = await schedulingService.getShiftsForWeek(weekStart)
      if (error) throw new Error(error)
      return data ?? []
    },
  })

  const setShiftMutation = useMutation({
    mutationFn: (shift: Parameters<typeof schedulingService.setShift>[0]) =>
      schedulingService.setShift(shift),
    onSuccess: (result) => {
      if (result.error) { toast.error(result.error); return }
      qc.invalidateQueries({ queryKey: ['shifts', weekStart] })
    },
  })

  const getShift = (staffId: string, date: string): any =>
    shifts.find((s: any) => s.staff_id === staffId && s.date === date)

  const cycleShift = (staffId: string, date: string) => {
    const current = getShift(staffId, date)
    const types: any[] = ['morning', 'evening', 'full', 'off']
    const next = types[(types.indexOf(current?.shift_type ?? 'off') + 1) % types.length]

    setShiftMutation.mutate({
      staff_id:   staffId,
      date,
      shift_type: next,
      start_time: next === 'morning' ? '09:00' : next === 'evening' ? '14:00' : next === 'full' ? '09:00' : undefined,
      end_time:   next === 'morning' ? '14:00' : next === 'evening' ? '20:00' : next === 'full' ? '20:00' : undefined,
    })
  }

  const prevWeek = () => setWeekStart(format(addDays(parseISO(weekStart), -7), 'yyyy-MM-dd'))
  const nextWeek = () => setWeekStart(format(addDays(parseISO(weekStart),  7), 'yyyy-MM-dd'))

  const totalShifts = shifts.filter(s => s.shift_type !== 'off').length
  const offCount    = shifts.filter(s => s.shift_type === 'off').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Shift Manager</h3>
            <p className="text-xs text-gray-500 mt-0.5">{totalShifts} active · {offCount} off · Click cell to cycle</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} />} onClick={prevWeek} />
            <span className="text-xs text-gray-300 w-36 text-center">
              {format(parseISO(weekStart), 'MMM d')} – {format(addDays(parseISO(weekStart), 6), 'MMM d, yyyy')}
            </span>
            <Button size="sm" variant="ghost" icon={<ChevronRight size={14} />} onClick={nextWeek} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-medium pb-3 pr-3 w-28">Staff</th>
                {weekDays.map((d, i) => (
                  <th key={d} className="text-center text-gray-400 font-medium pb-3 px-1 min-w-[80px]">
                    <div>{DAYS[i]}</div>
                    <div className="text-gray-600 text-xs">{format(parseISO(d), 'MMM d')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id} className="border-t border-white/5">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gold-500/10 border border-gold-500/15 flex items-center justify-center text-gold-400 font-bold text-xs shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-gray-300 font-medium truncate max-w-[70px]">{member.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  {weekDays.map(date => {
                    const shift = getShift(member.id, date)
                    const cfg   = SHIFT_CONFIG[(shift?.shift_type ?? 'off') as keyof typeof SHIFT_CONFIG]
                    return (
                      <td key={date} className="py-2 px-1 text-center">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => cycleShift(member.id, date)}
                          className={cn(
                            'w-full px-1 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1',
                            cfg.color
                          )}
                          title={`${member.name} — ${cfg.label} (${cfg.time})`}
                        >
                          {cfg.icon}
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </motion.button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex gap-3 flex-wrap mt-4 pt-4 border-t border-white/8">
          {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
            <div key={key} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs', cfg.color)}>
              {cfg.icon}
              {cfg.label} {cfg.time !== 'Day off' && <span className="text-gray-500">({cfg.time})</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
