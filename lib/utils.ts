import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, addMinutes, isWithinInterval, startOfDay, endOfDay } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'h:mm a')
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function generateTimeSlots(
  date: Date,
  durationMinutes: number,
  openTime = '09:00',
  closeTime = '20:00'
): Date[] {
  const slots: Date[] = []
  const [openH, openM]   = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)

  let current = new Date(date)
  current.setHours(openH, openM, 0, 0)
  const closing = new Date(date)
  closing.setHours(closeH, closeM, 0, 0)

  while (addMinutes(current, durationMinutes) <= closing) {
    slots.push(new Date(current))
    current = addMinutes(current, 30)
  }

  return slots
}

export function isPeakHour(date: Date): boolean {
  const hour = date.getHours()
  return (hour >= 10 && hour <= 12) || (hour >= 17 && hour <= 19)
}

export function calculateLoyaltyTier(points: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (points >= 5000) return 'platinum'
  if (points >= 2000) return 'gold'
  if (points >= 500)  return 'silver'
  return 'bronze'
}

export function tierColor(tier: string): string {
  const map: Record<string, string> = {
    platinum: 'text-cyan-400',
    gold:     'text-gold-500',
    silver:   'text-gray-300',
    bronze:   'text-amber-600',
  }
  return map[tier] ?? 'text-gray-400'
}

export function tierBadgeClass(tier: string): string {
  const map: Record<string, string> = {
    platinum: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    gold:     'bg-gold-500/20 text-gold-400 border border-gold-500/40',
    silver:   'bg-gray-400/20 text-gray-300 border border-gray-400/40',
    bronze:   'bg-amber-600/20 text-amber-500 border border-amber-600/40',
  }
  return map[tier] ?? 'bg-gray-700 text-gray-400'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:     'text-yellow-400',
    confirmed:   'text-blue-400',
    in_progress: 'text-purple-400',
    completed:   'text-green-400',
    cancelled:   'text-red-400',
    no_show:     'text-gray-400',
    waiting:     'text-yellow-400',
    called:      'text-blue-400',
    serving:     'text-purple-400',
    done:        'text-green-400',
  }
  return map[status] ?? 'text-gray-400'
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending:     'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    confirmed:   'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    in_progress: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    completed:   'bg-green-500/20 text-green-300 border border-green-500/40',
    cancelled:   'bg-red-500/20 text-red-300 border border-red-500/40',
    no_show:     'bg-gray-500/20 text-gray-300 border border-gray-500/40',
    waiting:     'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    called:      'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    serving:     'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    done:        'bg-green-500/20 text-green-300 border border-green-500/40',
  }
  return map[status] ?? 'bg-gray-700 text-gray-300'
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = String(item[key])
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
