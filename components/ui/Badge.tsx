import { cn } from '@/lib/utils'

interface BadgeProps {
  children:   React.ReactNode
  className?: string
  dot?:       boolean
  dotColor?:  string
}

export function Badge({ children, className, dot, dotColor = 'bg-gold-500' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />}
      {children}
    </span>
  )
}
