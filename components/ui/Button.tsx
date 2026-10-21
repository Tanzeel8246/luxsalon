'use client'
import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost' | 'danger' | 'secondary'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  icon?:    React.ReactNode
  iconPos?: 'left' | 'right'
}

const variants = {
  gold:      'bg-gold-gradient text-obsidian-950 font-semibold hover:shadow-gold-lg disabled:opacity-50',
  outline:   'border border-gold-500/50 text-gold-400 hover:bg-gold-500/10 hover:border-gold-400 disabled:opacity-40',
  ghost:     'text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-40',
  danger:    'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-40',
  secondary: 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 disabled:opacity-40',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', loading, icon, iconPos = 'left', className, children, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <>
          {icon && iconPos === 'left'  && <span className="shrink-0">{icon}</span>}
          {children}
          {icon && iconPos === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </motion.button>
  )
)

Button.displayName = 'Button'
