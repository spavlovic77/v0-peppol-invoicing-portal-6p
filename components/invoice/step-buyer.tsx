'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Building2, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { InvoiceFormData } from '@/lib/schemas'

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
}

export function StepBuyer({ formData, updateForm }: Props) {
  const [lookingUp, setLookingUp] = useState(false)
  const [buyerIco, setBuyerIco] = useState(formData.buyer_ico || '')

  async function lookupBuyer() {
    if (!buyerIco || buyerIco.length < 6) {
      toast.error('Zadajte platne ICO')
      return
    }
    setLookingUp(true)
    try {
      const res = await fetch(`/api/rpo?ico=${buyerIco}`)
      const data = await res.json()
      if (res.ok) {
        const peppolId = data.dic ? `0245:${data.dic}` : null
        updateForm({
          buyer_ico: data.ico,
          buyer_name: data.company_name || formData.buyer_name,
          buyer_dic: data.dic,
          buyer_ic_dph: data.ic_dph,
          buyer_street: data.street,
          buyer_city: data.city,
          buyer_postal_code: data.postal_code,
          buyer_peppol_id: peppolId,
        })
        toast.success('Udaje odberatela nacitane')
      } else {
        toast.error(data.error || 'Nepodarilo sa nacitat')
      }
    } catch {
      toast.error('Chyba pri komunikacii')
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ICO Lookup */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Vyhladat odberatela podla ICO</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={buyerIco}
            onChange={(e) => setBuyerIco(e.target.value)}
            placeholder="ICO odberatela"
            className="glass-input flex-1 px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
            maxLength={8}
          />
          <button
            onClick={lookupBuyer}
            disabled={lookingUp}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Vyhladat
          </button>
        </div>
      </GlassCard>

      {/* Buyer Details */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Udaje odberatela</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-muted-foreground mb-1.5">Nazov firmy *</label>
            <input
              type="text"
              value={formData.buyer_name}
              onChange={(e) => updateForm({ buyer_name: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Nazov odberatela"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">ICO</label>
            <input
              type="text"
              value={formData.buyer_ico || ''}
              onChange={(e) => updateForm({ buyer_ico: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">DIC</label>
            <input
              type="text"
              value={formData.buyer_dic || ''}
              onChange={(e) => updateForm({ buyer_dic: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">IC DPH</label>
            <input
              type="text"
              value={formData.buyer_ic_dph || ''}
              onChange={(e) => updateForm({ buyer_ic_dph: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">E-mail</label>
            <input
              type="email"
              value={formData.buyer_email || ''}
              onChange={(e) => updateForm({ buyer_email: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Ulica</label>
            <input
              type="text"
              value={formData.buyer_street || ''}
              onChange={(e) => updateForm({ buyer_street: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Mesto</label>
            <input
              type="text"
              value={formData.buyer_city || ''}
              onChange={(e) => updateForm({ buyer_city: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">PSC</label>
            <input
              type="text"
              value={formData.buyer_postal_code || ''}
              onChange={(e) => updateForm({ buyer_postal_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Krajina</label>
            <input
              type="text"
              value={formData.buyer_country_code}
              onChange={(e) => updateForm({ buyer_country_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              maxLength={2}
            />
          </div>
        </div>
      </GlassCard>

      {/* Peppol ID Preview */}
      {formData.buyer_dic && (
        <GlassCard className="border-primary/20">
          <div className="text-sm text-muted-foreground mb-1">Peppol ID odberatela</div>
          <div className="text-lg font-mono font-semibold text-primary">
            0245:{formData.buyer_dic}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
