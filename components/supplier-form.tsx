'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { Search, Save, Building2, CreditCard, Globe, Loader2, Trash2, Key, Eye, EyeOff } from 'lucide-react'

export interface SupplierFormData {
  ico: string
  dic: string
  ic_dph: string
  company_name: string
  street: string
  city: string
  postal_code: string
  country_code: string
  bank_name: string
  iban: string
  swift: string
  email: string
  phone: string
  web: string
  registration_court: string
  registration_number: string
  ap_api_key: string
  is_vat_payer: boolean
}

const emptyForm: SupplierFormData = {
  ico: '', dic: '', ic_dph: '', company_name: '', street: '', city: '',
  postal_code: '', country_code: 'SK', bank_name: '', iban: '', swift: '',
  email: '', phone: '', web: '', registration_court: '', registration_number: '',
  ap_api_key: '', is_vat_payer: true,
}

interface SupplierFormProps {
  initial?: Partial<SupplierFormData>
  supplierId?: string // if editing
}

export function SupplierForm({ initial, supplierId }: SupplierFormProps) {
  const [form, setForm] = useState<SupplierFormData>({ ...emptyForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [icoInput, setIcoInput] = useState(initial?.ico || '')
  const router = useRouter()
  const supabase = createClient()
  const { refreshSuppliers } = useActiveSupplier()
  const isEdit = !!supplierId

  function updateField(field: keyof SupplierFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function lookupICO() {
    if (!icoInput || icoInput.length < 6) {
      toast.error('Zadajte platne ICO (min. 6 znakov)')
      return
    }
    setLookingUp(true)
    try {
      const res = await fetch(`/api/rpo?ico=${icoInput}`)
      const data = await res.json()
      if (res.ok) {
        setForm((prev) => ({
          ...prev,
          ico: data.ico || icoInput,
          company_name: data.company_name || prev.company_name,
          dic: data.dic || prev.dic,
          ic_dph: data.ic_dph || prev.ic_dph,
          street: data.street || prev.street,
          city: data.city || prev.city,
          postal_code: data.postal_code || prev.postal_code,
          registration_court: data.registration_court || prev.registration_court,
          registration_number: data.registration_number || prev.registration_number,
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
    if (!form.company_name || !form.ico) {
      toast.error('Nazov firmy a ICO su povinne')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nie ste prihlaseny'); return }

      const payload = {
        user_id: user.id,
        ico: form.ico || icoInput,
        company_name: form.company_name,
        dic: form.dic || null,
        ic_dph: form.ic_dph || null,
        street: form.street || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        country_code: form.country_code || 'SK',
        bank_name: form.bank_name || null,
        iban: form.iban || null,
        swift: form.swift || null,
        email: form.email || null,
        phone: form.phone || null,
        web: form.web || null,
        registration_court: form.registration_court || null,
        registration_number: form.registration_number || null,
        ap_api_key: form.ap_api_key || null,
        is_vat_payer: form.is_vat_payer,
      }

      let error
      if (isEdit) {
        ;({ error } = await supabase.from('suppliers').update(payload).eq('id', supplierId))
      } else {
        ;({ error } = await supabase.from('suppliers').insert(payload))
      }

      if (error) {
        toast.error('Chyba pri ukladani: ' + error.message)
      } else {
        toast.success(isEdit ? 'Dodavatel bol aktualizovany' : 'Dodavatel bol vytvoreny')
        await refreshSuppliers()
        router.push('/suppliers')
      }
    } catch {
      toast.error('Neocakavana chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!supplierId) return
    if (!confirm('Naozaj chcete zmazat tohto dodavatela? Vsetky jeho faktury zostanu zachovane.')) return

    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId)
    if (error) {
      toast.error('Chyba pri mazani: ' + error.message)
    } else {
      toast.success('Dodavatel bol zmazany')
      await refreshSuppliers()
      router.push('/suppliers')
    }
  }

  return (
    <div className="space-y-6">
      {/* ICO Lookup */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Vyhladanie podla ICO</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={icoInput}
            onChange={(e) => setIcoInput(e.target.value)}
            placeholder="Zadajte ICO (napr. 36421928)"
            className="glass-input flex-1 px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
            maxLength={10}
          />
          <button
            onClick={lookupICO}
            disabled={lookingUp}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lookingUp ? 'Hladam...' : 'Vyhladat'}
          </button>
        </div>
        {lookingUp && (
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton h-3 w-20 mb-2" />
                <div className="skeleton h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Company Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Udaje o firme</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nazov firmy *" value={form.company_name} onChange={(v) => updateField('company_name', v)} />
          <Field label="ICO" value={form.ico} onChange={(v) => updateField('ico', v)} />
          <Field label="DIC" value={form.dic} onChange={(v) => updateField('dic', v)} />
          {form.is_vat_payer && (
            <Field label="IC DPH" value={form.ic_dph} onChange={(v) => updateField('ic_dph', v)} />
          )}
          <Field label="Ulica" value={form.street} onChange={(v) => updateField('street', v)} />
          <Field label="Mesto" value={form.city} onChange={(v) => updateField('city', v)} />
          <Field label="PSC" value={form.postal_code} onChange={(v) => updateField('postal_code', v)} />
          <Field label="Krajina" value={form.country_code} onChange={(v) => updateField('country_code', v)} />
          <Field label="Registracny sud" value={form.registration_court} onChange={(v) => updateField('registration_court', v)} className="md:col-span-2" />
          <Field label="Cislo zapisu" value={form.registration_number} onChange={(v) => updateField('registration_number', v)} className="md:col-span-2" />
        </div>
        <div className="mt-5 pt-5 border-t border-border">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_vat_payer}
              onChange={(e) => setForm((prev) => ({ ...prev, is_vat_payer: e.target.checked, ic_dph: e.target.checked ? prev.ic_dph : '' }))}
              className="w-5 h-5 rounded border-border bg-background text-primary accent-primary cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Platca DPH</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.is_vat_payer
                  ? 'Faktury budu vystavene s DPH a rekapitulaciou dane'
                  : 'Faktury budu vystavene bez DPH (dodavatel nie je platcom DPH)'
                }
              </p>
            </div>
          </label>
        </div>
      </GlassCard>

      {/* Payment Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Platobne udaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nazov banky" value={form.bank_name} onChange={(v) => updateField('bank_name', v)} />
          <Field label="IBAN" value={form.iban} onChange={(v) => updateField('iban', v)} />
          <Field label="SWIFT/BIC" value={form.swift} onChange={(v) => updateField('swift', v)} />
        </div>
      </GlassCard>

      {/* Contact Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Kontaktne udaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="E-mail" value={form.email} onChange={(v) => updateField('email', v)} type="email" />
          <Field label="Telefon" value={form.phone} onChange={(v) => updateField('phone', v)} type="tel" />
          <Field label="Web stranka" value={form.web} onChange={(v) => updateField('web', v)} className="md:col-span-2" />
        </div>
      </GlassCard>

      {/* AP API Key */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Peppol Access Point (ION AP)</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          API kluc pre odosielanie faktur cez Peppol siet. Ziskate ho na{' '}
          <a href="https://ion-ap.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">ion-ap.net</a>
        </p>
        <div className="relative">
          <label className="block text-sm text-muted-foreground mb-1.5">AP API kluc</label>
          <div className="flex gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.ap_api_key}
              onChange={(e) => updateField('ap_api_key', e.target.value)}
              placeholder="napr. d5ac88320c6078db43677a00ecd2a9a3d3d2bcf5"
              className="glass-input flex-1 px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-2.5 rounded-xl glass-card text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={showApiKey ? 'Skryt kluc' : 'Zobrazit kluc'}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {form.ap_api_key && (
          <div className="mt-3 flex items-center gap-2 text-xs text-success">
            <div className="w-2 h-2 rounded-full bg-success" />
            AP kluc je nastaveny - mozete odosielat faktury cez Peppol
          </div>
        )}
      </GlassCard>

      {/* Peppol ID Preview */}
      {form.dic && (
        <GlassCard className="border-primary/20">
          <div className="text-sm text-muted-foreground mb-1">Peppol ID tohto dodavatela</div>
          <div className="text-lg font-mono font-semibold text-primary">
            9950:{form.dic}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Schema 9950 (Peppol test) + DIC
          </div>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {isEdit && (
            <button
              onClick={handleDelete}
              className="px-5 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Zmazat dodavatela
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.company_name || !form.ico}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Ulozit zmeny' : 'Vytvorit dodavatela'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', className = '',
}: {
  label: string; value: string | null | undefined; onChange: (v: string) => void; type?: string; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
      />
    </div>
  )
}
