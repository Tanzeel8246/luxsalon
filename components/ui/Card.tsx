'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children:  React.ReactNode
  className?: string
  hover?:     boolean
  gold?:      boolean
  onClick?:   () => void
}

export function Card({ children, className, hover, gold, onClick }: CardProps) {
  const base = cn(
    'rounded-xl border bg-obsidian-950/60 backdrop-blur-sm',
    gold ? 'border-gold-500/30 shadow-gold' : 'border-white/8',
    hover && 'cursor-pointer hover:border-gold-500/40 hover:bg-white/5',
    className
  )

  if (hover || onClick) {
    return (
      <motion.div
        className={base}
        whileHover={{ y: -2 }}
        onClick={onClick}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    )
  }

  return <div className={base}>{children}</div>
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-b border-white/8', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-t border-white/8', className)}>
      {children}
    </div>
  )
}
