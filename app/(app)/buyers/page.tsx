'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { toast } from 'sonner'
import { Contact, Plus, Pencil, Trash2, Search, Save, Loader2, X, Building2 } from 'lucide-react'
import { ConfirmModal } from '@/components/confirm-modal'

interface BuyerContact {
  id: string
  supplier_id: string
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

const emptyBuyer: Omit<BuyerContact, 'id' | 'supplier_id'> = {
  ico: '', dic: '', ic_dph: '', company_name: '', street: '', city: '',
  postal_code: '', country_code: 'SK', email: '', peppol_id: '',
}

export default function BuyersPage() {
  const supabase = createClient()
  const { activeSupplier, loading: supplierLoading } = useActiveSupplier()
  const [buyers, setBuyers] = useState<BuyerContact[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyBuyer)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  const loadBuyers = useCallback(async () => {
    if (!activeSupplier) { setLoading(false); return }
    const { data } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('supplier_id', activeSupplier.id)
      .order('company_name')
    setBuyers((data ?? []) as BuyerContact[])
    setLoading(false)
  }, [activeSupplier, supabase])

  useEffect(() => { loadBuyers() }, [loadBuyers])

  async function lookupICO() {
  const sanitized = (form.ico || '').replace(/\s/g, '')
  setForm(prev => ({ ...prev, ico: sanitized }))
  if (!sanitized || sanitized.length < 6) {
  toast.error('Zadajte platne ICO (min. 6 znakov)')
  return
  }
  setLookingUp(true)
  try {
  const res = await fetch(`/api/rpo?ico=${sanitized}`)
      const data = await res.json()
      if (res.ok) {
        setForm((prev) => ({
          ...prev,
          company_name: data.company_name || prev.company_name,
          dic: data.dic || prev.dic,
          ic_dph: data.ic_dph || prev.ic_dph,
          street: data.street || prev.street,
          city: data.city || prev.city,
          postal_code: data.postal_code || prev.postal_code,
          peppol_id: data.dic ? `0245:${data.dic}` : prev.peppol_id,
        }))
        toast.success('Udaje boli nacitane z registra')
      } else {
        toast.error(data.error || 'Nepodarilo sa nacitat udaje')
      }
    } catch {
      toast.error('Chyba pri komunikacii so serverom')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSave() {
    if (!form.company_name) { toast.error('Nazov firmy je povinny'); return }
    if (!activeSupplier) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const payload = {
        supplier_id: activeSupplier.id,
        user_id: user.id,
        ico: form.ico || null,
        dic: form.dic || null,
        ic_dph: form.ic_dph || null,
        company_name: form.company_name,
        street: form.street || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        country_code: form.country_code || 'SK',
        email: form.email || null,
        peppol_id: form.peppol_id || null,
      }

      let error
      if (editingId) {
        ;({ error } = await supabase.from('buyer_contacts').update(payload).eq('id', editingId))
      } else {
        ;({ error } = await supabase.from('buyer_contacts').insert(payload))
      }

      if (error) {
        toast.error('Chyba: ' + error.message)
      } else {
        toast.success(editingId ? 'Kontakt bol aktualizovany' : 'Kontakt bol pridany')
        setShowForm(false)
        setEditingId(null)
        setForm(emptyBuyer)
        await loadBuyers()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('buyer_contacts').delete().eq('id', id)
    if (error) { toast.error('Chyba: ' + error.message) } else {
      toast.success('Kontakt bol zmazany')
      await loadBuyers()
    }
  }

  function startEdit(buyer: BuyerContact) {
    setForm({
      ico: buyer.ico || '', dic: buyer.dic || '', ic_dph: buyer.ic_dph || '',
      company_name: buyer.company_name, street: buyer.street || '',
      city: buyer.city || '', postal_code: buyer.postal_code || '',
      country_code: buyer.country_code || 'SK', email: buyer.email || '',
      peppol_id: buyer.peppol_id || '',
    })
    setEditingId(buyer.id)
    setShowForm(true)
  }

  if (supplierLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-36 mb-2" />
            <div className="skeleton h-4 w-56" />
          </div>
          <div className="skeleton h-10 w-40 rounded-xl" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-6">
            <div className="skeleton h-5 w-40 mb-2" />
            <div className="skeleton h-3 w-64" />
          </div>
        ))}
      </div>
    )
  }

  if (!activeSupplier) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard className="text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Najprv vytvorte dodavatela</h2>
          <p className="text-muted-foreground">Kontakty odberatelov su viazane na konkretneho dodavatela.</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Odberatelia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kontakty pre {activeSupplier.company_name}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setForm(emptyBuyer); setEditingId(null); setShowForm(true) }}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Pridať odberateľa
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-foreground">
              {editingId ? 'Upraviť odberateľa' : 'Nový odberateľ'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ICO Lookup */}
          <div className="flex gap-3 mb-4">
            <input
              type="text" value={form.ico || ''} onChange={(e) => setForm({ ...form, ico: e.target.value })}
              placeholder="ICO odberatela" className="glass-input flex-1 px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground" maxLength={10}
            />
            <button onClick={lookupICO} disabled={lookingUp}
              className="px-4 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Vyhladat
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <BField label="Názov firmy *" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
            <BField label="ICO" value={form.ico || ''} onChange={(v) => setForm({ ...form, ico: v })} />
            <BField label="DIC" value={form.dic || ''} onChange={(v) => setForm({ ...form, dic: v })} />
            <BField label="IC DPH" value={form.ic_dph || ''} onChange={(v) => setForm({ ...form, ic_dph: v })} />
            <BField label="E-mail" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} />
            <BField label="Ulica" value={form.street || ''} onChange={(v) => setForm({ ...form, street: v })} />
            <BField label="Mesto" value={form.city || ''} onChange={(v) => setForm({ ...form, city: v })} />
            <BField label="PSC" value={form.postal_code || ''} onChange={(v) => setForm({ ...form, postal_code: v })} />
            <BField label="Peppol ID" value={form.peppol_id || ''} onChange={(v) => setForm({ ...form, peppol_id: v })} placeholder="napr. 0245:2022182030" />
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving || !form.company_name}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'Uložiť zmeny' : 'Pridať kontakt'}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Buyer List */}
      {buyers.length === 0 && !showForm ? (
        <GlassCard className="text-center py-16">
          <Contact className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Žiadne uložené kontakty</h2>
          <p className="text-muted-foreground">
            Pridajte odberatelov, aby ste ich mohli rychlo pouzit pri tvorbe faktury
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {buyers.map((b) => (
            <GlassCard key={b.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">{b.company_name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    {b.ico && <span>{'ICO: '}{b.ico}</span>}
                    {b.dic && <span>{'DIC: '}{b.dic}</span>}
                    {(b.street || b.city) && (
                      <span>{[b.street, b.postal_code, b.city].filter(Boolean).join(', ')}</span>
                    )}
                    {b.peppol_id && <span className="font-mono text-xs text-primary/70">Peppol: {b.peppol_id}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(b)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTargetId(b.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <ConfirmModal
        open={!!deleteTargetId}
        title="Zmazat kontakt"
        description="Naozaj chcete zmazat tento kontakt odberatela?"
        confirmLabel="Zmazat"
        variant="danger"
        onConfirm={() => { if (deleteTargetId) { handleDelete(deleteTargetId); setDeleteTargetId(null) } }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}

function BField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1.5">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground" />
    </div>
  )
}
