'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  label?:   string
  error?:   string
  hint?:    string
  prefix?:  React.ReactNode
  suffix?:  React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500',
              'px-3 py-2.5 text-sm',
              'focus:outline-none focus:border-gold-500/70 focus:ring-1 focus:ring-gold-500/30',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20',
              prefix && 'pl-10',
              suffix && 'pr-10',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 text-gray-400">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
