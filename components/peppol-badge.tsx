'use client'

import { CheckCircle2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md'
  variant?: 'solid' | 'soft'
  className?: string
  label?: string
}

export function PeppolBadge({ size = 'sm', variant = 'soft', className, label = 'Peppol Ready' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium shrink-0',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        variant === 'solid'
          ? 'bg-success text-success-foreground'
          : 'bg-success/15 text-success',
        className
      )}
      title="Firma je registrovaná v Peppol sieti"
    >
      <CheckCircle2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </span>
  )
}

export function PeppolUnregisteredBadge({ size = 'sm', className }: Pick<Props, 'size' | 'className'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium shrink-0 bg-muted text-muted-foreground',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
      title="Firma nie je registrovaná v Peppol sieti"
    >
      <Globe className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Bez Peppol
    </span>
  )
}
