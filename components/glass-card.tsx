import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  heavy?: boolean
  onClick?: () => void
}

export function GlassCard({ children, className, heavy, onClick }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-6',
        heavy ? 'glass-card-heavy' : 'glass-card',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      {children}
    </div>
  )
}
