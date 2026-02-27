import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  heavy?: boolean
}

export function GlassCard({ children, className, heavy }: GlassCardProps) {
  return (
    <div className={cn(
      'rounded-2xl p-6',
      heavy ? 'glass-card-heavy' : 'glass-card',
      className
    )}>
      {children}
    </div>
  )
}
