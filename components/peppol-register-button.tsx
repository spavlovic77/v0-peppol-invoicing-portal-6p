'use client'

import { useState } from 'react'
import { Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  supplierId: string
  supplierDic: string | null
  onRegistered?: (orgId: number) => void
  size?: 'sm' | 'md'
  className?: string
}

export function PeppolRegisterButton({
  supplierId,
  supplierDic,
  onRegistered,
  size = 'sm',
  className,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleRegister(e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    if (!supplierDic) {
      toast.error('Dodávateľ musí mať vyplnené DIČ pred registráciou')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/peppol/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.already_registered) {
        toast.info('Firma už bola registrovaná v Peppol')
      } else {
        toast.success('Firma je Peppol Ready')
      }
      onRegistered?.(data.peppol_organization_id)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRegister}
      disabled={loading || !supplierDic}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm'
          ? 'px-2.5 py-1.5 text-xs'
          : 'px-3 py-2 text-sm',
        'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20',
        className
      )}
      title={!supplierDic ? 'Chýba DIČ' : 'Zaregistrovať firmu do Peppol siete'}
    >
      {loading ? (
        <Loader2 className={size === 'sm' ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} />
      ) : (
        <Globe className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      )}
      {loading ? 'Registrujem...' : 'Registrovať do Peppol'}
    </button>
  )
}
