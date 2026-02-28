'use client'

import { useState, useEffect, useCallback } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Building2, Search, Loader2, Contact, CheckCircle2, XCircle, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceFormData } from '@/lib/schemas'

interface BuyerContact {
  id: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  company_name: string
  street: string | null
  city: string | null
  postal_code: string | null
  country_code: string
  email: string | null
  peppol_id: string | null
}

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
  supplierId?: string
}

export function StepBuyer({ formData, updateForm, supplierId }: Props) {
  const [lookingUp, setLookingUp] = useState(false)
  const [buyerIco, setBuyerIco] = useState(formData.buyer_ico || '')
  const [contacts, setContacts] = useState<BuyerContact[]>([])
  const [showContacts, setShowContacts] = useState(false)
  const [peppolStatus, setPeppolStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'error' | 'no_key'>('idle')
  const supabase = createClient()

  // Check Peppol presence when buyer DIC changes
  useEffect(() => {
    if (!formData.buyer_dic || !supplierId) {
      setPeppolStatus('idle')
      return
    }
    const participantId = `9950:${formData.buyer_dic}`
    setPeppolStatus('checking')
    fetch(`/api/peppol/discover?participant_id=${encodeURIComponent(participantId)}&supplier_id=${supplierId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error?.includes('API kluc')) {
          setPeppolStatus('no_key')
        } else if (data.found) {
          setPeppolStatus('found')
        } else {
          setPeppolStatus('not_found')
        }
      })
      .catch(() => setPeppolStatus('error'))
  }, [formData.buyer_dic, supplierId])

  const loadContacts = useCallback(async () => {
    if (!supplierId) return
    const { data } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('company_name')
    setContacts((data ?? []) as BuyerContact[])
  }, [supplierId, supabase])

  useEffect(() => { loadContacts() }, [loadContacts])

  function selectContact(c: BuyerContact) {
    updateForm({
      buyer_ico: c.ico,
      buyer_dic: c.dic,
      buyer_ic_dph: c.ic_dph,
      buyer_name: c.company_name,
      buyer_street: c.street,
      buyer_city: c.city,
      buyer_postal_code: c.postal_code,
      buyer_country_code: c.country_code || 'SK',
      buyer_email: c.email,
      buyer_peppol_id: c.peppol_id,
    })
    setBuyerIco(c.ico || '')
    setShowContacts(false)
    toast.success('Kontakt vybrany: ' + c.company_name)
  }

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
        const peppolId = data.dic ? `9950:${data.dic}` : null
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
      {/* Saved Contacts */}
      {contacts.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Contact className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Ulozene kontakty</h2>
            </div>
            <button
              onClick={() => setShowContacts(!showContacts)}
              className="text-sm text-primary hover:underline"
            >
              {showContacts ? 'Skryt' : `Zobrazit (${contacts.length})`}
            </button>
          </div>
          {showContacts && (
            <div className="grid gap-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full text-left px-4 py-3 rounded-xl glass-input hover:bg-secondary transition-colors"
                >
                  <div className="font-medium text-foreground text-sm">{c.company_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.ico && `ICO: ${c.ico}`}
                    {c.city && ` | ${c.city}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassCard>
      )}

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
            maxLength={10}
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
            <input type="text" value={formData.buyer_name}
              onChange={(e) => updateForm({ buyer_name: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" placeholder="Nazov odberatela" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">ICO</label>
            <input type="text" value={formData.buyer_ico || ''}
              onChange={(e) => updateForm({ buyer_ico: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">DIC</label>
            <input type="text" value={formData.buyer_dic || ''}
              onChange={(e) => updateForm({ buyer_dic: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">IC DPH</label>
            <input type="text" value={formData.buyer_ic_dph || ''}
              onChange={(e) => updateForm({ buyer_ic_dph: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">E-mail</label>
            <input type="email" value={formData.buyer_email || ''}
              onChange={(e) => updateForm({ buyer_email: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Ulica</label>
            <input type="text" value={formData.buyer_street || ''}
              onChange={(e) => updateForm({ buyer_street: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Mesto</label>
            <input type="text" value={formData.buyer_city || ''}
              onChange={(e) => updateForm({ buyer_city: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">PSC</label>
            <input type="text" value={formData.buyer_postal_code || ''}
              onChange={(e) => updateForm({ buyer_postal_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Krajina</label>
            <input type="text" value={formData.buyer_country_code}
              onChange={(e) => updateForm({ buyer_country_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground" maxLength={2} />
          </div>
        </div>
      </GlassCard>

      {/* Peppol ID Preview + Status */}
      {formData.buyer_dic && (
        <GlassCard className={peppolStatus === 'found' ? 'border-success/30' : peppolStatus === 'not_found' ? 'border-warning/30' : 'border-primary/20'}>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Peppol</h2>
          </div>
          <div className="text-base font-mono font-semibold text-primary mb-3">
            9950:{formData.buyer_dic}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {peppolStatus === 'checking' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Overujem registraciu na Peppol...</span>
              </>
            )}
            {peppolStatus === 'found' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-success font-medium">Odberatel je registrovany na Peppol</span>
              </>
            )}
            {peppolStatus === 'not_found' && (
              <>
                <XCircle className="w-4 h-4 text-warning" />
                <span className="text-warning font-medium">Odberatel nie je registrovany na Peppol</span>
              </>
            )}
            {peppolStatus === 'no_key' && (
              <span className="text-xs text-muted-foreground">AP API kluc nie je nastaveny - overenie Peppol nedostupne</span>
            )}
            {peppolStatus === 'error' && (
              <span className="text-xs text-muted-foreground">Nepodarilo sa overit Peppol registraciu</span>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
