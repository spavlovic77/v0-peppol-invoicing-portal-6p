'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Send, Trash2, X } from 'lucide-react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Potvrdit',
  cancelLabel = 'Zrusit',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus()
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [open, onCancel])

  if (!open) return null

  const iconColor =
    variant === 'danger' ? 'text-red-500' :
    variant === 'warning' ? 'text-amber-500' :
    'text-primary'

  const iconBg =
    variant === 'danger' ? 'bg-red-500/10' :
    variant === 'warning' ? 'bg-amber-500/10' :
    'bg-primary/10'

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : variant === 'warning'
        ? 'bg-amber-500 hover:bg-amber-600 text-white'
        : 'bg-primary hover:bg-primary/90 text-primary-foreground'

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? Send : AlertTriangle

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="confirm-title" className="font-semibold text-foreground">{title}</h3>
              <p id="confirm-desc" className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              aria-label="Zavriet"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
