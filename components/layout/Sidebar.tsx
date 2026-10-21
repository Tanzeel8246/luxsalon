'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarDays, Users, ListOrdered, Package,
  BarChart3, Settings, LogOut, Scissors, ChevronLeft, ChevronRight,
  ShieldCheck, Brain, CreditCard, Megaphone, Sparkles, Building2,
  Shield, Clock, Boxes, ClipboardList, Zap, Link as LinkIcon,
  Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore { collapsed: boolean; setCollapsed: (c: boolean) => void }
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({ collapsed: false, setCollapsed: (collapsed) => set({ collapsed }) }),
    { name: 'sidebar-store' }
  )
)

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard',               label: 'Dashboard',      icon: LayoutDashboard, roles: ['admin','staff','customer'] },
      { href: '/booking',                  label: 'Booking',        icon: CalendarDays,    roles: ['admin','staff','customer'] },
      { href: '/queue',                    label: 'Live Queue',     icon: ListOrdered,     roles: ['admin','staff','customer'] },
    ],
  },
  {
    label: 'AI & Analytics',
    items: [
      { href: '/dashboard/analytics',      label: 'AI Analytics',   icon: Brain,           roles: ['admin'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/pos',            label: 'POS Terminal',   icon: CreditCard,      roles: ['admin','staff'] },
      { href: '/dashboard/marketing',      label: 'Marketing & CRM',icon: Megaphone,       roles: ['admin'] },
    ],
  },
  {
    label: 'Customer',
    items: [
      { href: '/dashboard/experience',     label: 'CX & Waitlist',  icon: Sparkles,        roles: ['admin','staff'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/scheduling',     label: 'Scheduling',     icon: Clock,           roles: ['admin','staff'] },
      { href: '/dashboard/operations',     label: 'Operations',     icon: ClipboardList,   roles: ['admin','staff'] },
      { href: '/dashboard/inventory',      label: 'Inventory',      icon: Package,         roles: ['admin','staff'] },
      { href: '/dashboard/suppliers',      label: 'Adv. Inventory', icon: Boxes,           roles: ['admin','staff'] },
      { href: '/dashboard/staff',          label: 'Staff',          icon: Users,           roles: ['admin'] },
    ],
  },
  {
    label: 'Multi-Branch',
    items: [
      { href: '/dashboard/branches',       label: 'Branches',       icon: Building2,       roles: ['admin'] },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/security',       label: 'Security',       icon: Shield,          roles: ['admin'] },
      { href: '/dashboard/system',         label: 'System & API',   icon: Zap,             roles: ['admin'] },
      { href: '/dashboard/admin',          label: 'Admin Panel',    icon: ShieldCheck,     roles: ['admin'] },
      { href: '/dashboard/settings',       label: 'Settings',       icon: Settings,        roles: ['admin','staff','customer'] },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { collapsed, setCollapsed } = useSidebarStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => user?.role && item.roles.includes(user.role)),
  })).filter(group => group.items.length > 0)

  if (!mounted) {
    return (
      <aside className="relative flex flex-col h-screen bg-obsidian-950 border-r border-white/8 overflow-hidden shrink-0 z-30" style={{ width: 240 }}></aside>
    )
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen bg-obsidian-950 border-r border-white/8 overflow-hidden shrink-0 z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
        <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shrink-0">
          <Scissors size={16} className="text-obsidian-950" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <p className="font-display font-bold text-white text-sm leading-tight">LuxSalon</p>
              <p className="text-xs text-gold-500 font-medium">Smart Groom V4</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4 scrollbar-hide">
        {filteredGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 group',
                      collapsed ? 'justify-center' : '',
                      isActive
                        ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon size={16} className="shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-xs font-medium whitespace-nowrap truncate flex-1">
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && !collapsed && (
                      <motion.div layoutId="active-nav" className="w-1 h-3.5 rounded-full bg-gold-500 shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-2 py-3 border-t border-white/8 space-y-0.5">
        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/3 mb-1">
            <div className="w-6 h-6 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0">
              <span className="text-gold-400 text-xs font-bold">{user.email?.[0].toUpperCase()}</span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.email}</p>
              <p className="text-xs text-gold-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors',
            collapsed ? 'justify-center' : ''
          )}
        >
          <LogOut size={15} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs">
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 w-6 h-6 rounded-full bg-obsidian-900 border border-white/15 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold-500/50 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  )
}
