'use client'

import { useState, useEffect, useCallback } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Building2, Search, Loader2, Contact, CheckCircle2, XCircle, Globe, ChevronDown, Star } from 'lucide-react'
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

interface FrequentBuyer extends BuyerContact {
  invoice_count: number
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
  const [frequentBuyers, setFrequentBuyers] = useState<FrequentBuyer[]>([])
  const [showAllContacts, setShowAllContacts] = useState(false)
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

  // Load all saved contacts for this supplier
  const loadContacts = useCallback(async () => {
    if (!supplierId) return
    const { data } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('company_name')
    setContacts((data ?? []) as BuyerContact[])
  }, [supplierId, supabase])

  // Load top 5 most frequently invoiced buyers
  const loadFrequentBuyers = useCallback(async () => {
    if (!supplierId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Query invoices grouped by buyer_ico, count per buyer, join with buyer_contacts
    const { data: invoiceGroups } = await supabase
      .from('invoices')
      .select('buyer_ico, buyer_name')
      .eq('user_id', user.id)
      .eq('supplier_id', supplierId)
      .not('buyer_ico', 'is', null)

    if (!invoiceGroups || invoiceGroups.length === 0) return

    // Count frequency per buyer_ico
    const freqMap = new Map<string, { name: string; count: number }>()
    for (const inv of invoiceGroups) {
      if (!inv.buyer_ico) continue
      const existing = freqMap.get(inv.buyer_ico)
      if (existing) {
        existing.count++
      } else {
        freqMap.set(inv.buyer_ico, { name: inv.buyer_name, count: 1 })
      }
    }

    // Sort by count desc, take top 5
    const top5Icos = Array.from(freqMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([ico]) => ico)

    if (top5Icos.length === 0) return

    // Fetch full contact details for these buyers
    const { data: contactData } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .in('ico', top5Icos)

    if (!contactData) return

    // Merge counts into contact data
    const result: FrequentBuyer[] = contactData.map((c) => ({
      ...(c as BuyerContact),
      invoice_count: freqMap.get(c.ico ?? '')?.count ?? 0,
    }))

    // Sort by frequency
    result.sort((a, b) => b.invoice_count - a.invoice_count)
    setFrequentBuyers(result)
  }, [supplierId, supabase])

  useEffect(() => { loadContacts() }, [loadContacts])
  useEffect(() => { loadFrequentBuyers() }, [loadFrequentBuyers])

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
    setShowAllContacts(false)
  }

  // Auto-save buyer to buyer_contacts (silent upsert)
  async function autoSaveBuyer(buyerData: {
    ico: string; company_name: string; dic?: string | null; ic_dph?: string | null;
    street?: string | null; city?: string | null; postal_code?: string | null;
    country_code?: string; peppol_id?: string | null;
  }) {
    if (!supplierId || !buyerData.ico) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if this buyer already exists for this supplier
    const { data: existing } = await supabase
      .from('buyer_contacts')
      .select('id')
      .eq('user_id', user.id)
      .eq('supplier_id', supplierId)
      .eq('ico', buyerData.ico)
      .maybeSingle()

    if (existing) {
      // Update existing contact
      await supabase.from('buyer_contacts').update({
        company_name: buyerData.company_name,
        dic: buyerData.dic || null,
        ic_dph: buyerData.ic_dph || null,
        street: buyerData.street || null,
        city: buyerData.city || null,
        postal_code: buyerData.postal_code || null,
        country_code: buyerData.country_code || 'SK',
        peppol_id: buyerData.peppol_id || null,
      }).eq('id', existing.id)
    } else {
      // Insert new contact
      await supabase.from('buyer_contacts').insert({
        user_id: user.id,
        supplier_id: supplierId,
        ico: buyerData.ico,
        company_name: buyerData.company_name,
        dic: buyerData.dic || null,
        ic_dph: buyerData.ic_dph || null,
        street: buyerData.street || null,
        city: buyerData.city || null,
        postal_code: buyerData.postal_code || null,
        country_code: buyerData.country_code || 'SK',
        peppol_id: buyerData.peppol_id || null,
      })
    }

    // Refresh contacts list
    loadContacts()
  }

  async function lookupBuyer() {
  const sanitized = buyerIco.replace(/\s/g, '')
  setBuyerIco(sanitized)
  if (!sanitized || sanitized.length < 6) {
  toast.error('Zadajte platne ICO')
  return
  }
  setLookingUp(true)
  try {
  const res = await fetch(`/api/rpo?ico=${sanitized}`)
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

        // Auto-save to buyer_contacts silently
        autoSaveBuyer({
          ico: data.ico,
          company_name: data.company_name,
          dic: data.dic,
          ic_dph: data.ic_dph,
          street: data.street,
          city: data.city,
          postal_code: data.postal_code,
          country_code: 'SK',
          peppol_id: peppolId,
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

  // Remaining contacts not in the top-5 frequent list
  const frequentIcos = new Set(frequentBuyers.map((b) => b.ico))
  const restContacts = contacts.filter((c) => !frequentIcos.has(c.ico))

  return (
    <div className="space-y-4">
      {/* Top 5 Frequent Buyers */}
      {frequentBuyers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">\u010Cast\u00ED odberate\u013Eia</span>
          </div>
          <div className="grid gap-2">
            {frequentBuyers.map((b) => {
              const isSelected = formData.buyer_ico === b.ico && formData.buyer_name === b.company_name
              return (
                <button
                  key={b.id}
                  onClick={() => selectContact(b)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-primary/15 border border-primary/30'
                      : 'glass-input hover:bg-secondary'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{b.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      ICO: {b.ico}
                      <span className="ml-2 text-muted-foreground/60">{b.invoice_count}x</span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Remaining contacts (expandable) */}
      {restContacts.length > 0 && (
        <div>
          <button
            onClick={() => setShowAllContacts(!showAllContacts)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Contact className="w-4 h-4" />
            <span>{showAllContacts ? 'Skry\u0165 ostatn\u00FDch' : `Zobrazi\u0165 v\u0161etk\u00FDch (${restContacts.length})`}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllContacts ? 'rotate-180' : ''}`} />
          </button>
          {showAllContacts && (
            <div className="grid gap-1.5 mt-2">
              {restContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full text-left px-3.5 py-2 rounded-xl glass-input hover:bg-secondary transition-colors text-sm"
                >
                  <div className="font-medium text-foreground truncate">{c.company_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.ico && `ICO: ${c.ico}`}
                    {c.city && ` | ${c.city}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ICO Lookup */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-3">
          <Search className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Vyh\u013Eada\u0165 pod\u013Ea I\u010CO</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={buyerIco}
            onChange={(e) => setBuyerIco(e.target.value)}
            placeholder="ICO odberatela"
            className="glass-input flex-1 px-3.5 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground text-sm"
            maxLength={10}
          />
          <button
            onClick={lookupBuyer}
            disabled={lookingUp}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            H\u013Eada\u0165
          </button>
        </div>
      </GlassCard>

      {/* Buyer Details */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">\u00DAdaje odberate\u013Ea</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">N\u00E1zov firmy *</label>
            <input id="buyer_name" type="text" value={formData.buyer_name}
              onChange={(e) => updateForm({ buyer_name: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" placeholder="N\u00E1zov odberate\u013Ea" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ICO</label>
            <input type="text" value={formData.buyer_ico || ''}
              onChange={(e) => updateForm({ buyer_ico: e.target.value.replace(/\s/g, '') })}
              onBlur={(e) => { const v = e.target.value.replace(/\s/g, ''); if (v !== e.target.value) updateForm({ buyer_ico: v }) }}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">DIC</label>
            <input id="buyer_dic" type="text" value={formData.buyer_dic || ''}
              onChange={(e) => updateForm({ buyer_dic: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">IC DPH</label>
            <input type="text" value={formData.buyer_ic_dph || ''}
              onChange={(e) => updateForm({ buyer_ic_dph: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
            <input type="email" value={formData.buyer_email || ''}
              onChange={(e) => updateForm({ buyer_email: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Ulica</label>
            <input type="text" value={formData.buyer_street || ''}
              onChange={(e) => updateForm({ buyer_street: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Mesto</label>
            <input type="text" value={formData.buyer_city || ''}
              onChange={(e) => updateForm({ buyer_city: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">PSC</label>
            <input type="text" value={formData.buyer_postal_code || ''}
              onChange={(e) => updateForm({ buyer_postal_code: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Krajina</label>
            <input id="buyer_country_code" type="text" value={formData.buyer_country_code}
              onChange={(e) => updateForm({ buyer_country_code: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground text-sm" maxLength={2} />
          </div>
        </div>
      </GlassCard>

      {/* Peppol ID Preview + Status */}
      {formData.buyer_dic && (
        <GlassCard className={peppolStatus === 'found' ? 'border-success/30' : peppolStatus === 'not_found' ? 'border-warning/30' : 'border-primary/20'}>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Peppol</h2>
          </div>
          <div className="text-sm font-mono font-semibold text-primary mb-2">
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
                <span className="text-success font-medium">Odberate\u013E je registrovan\u00FD na Peppol</span>
              </>
            )}
            {peppolStatus === 'not_found' && (
              <>
                <XCircle className="w-4 h-4 text-warning" />
                <span className="text-warning font-medium">Odberate\u013E nie je registrovan\u00FD na Peppol</span>
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
