'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { Search, Save, Building2, CreditCard, Globe, Loader2, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cleanIban, formatIban, validateIban } from '@/lib/iban'
import { ConfirmModal } from '@/components/confirm-modal'
import { PEPPOL_IDENTIFIER_SCHEME } from '@/lib/constants'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [icoInput, setIcoInput] = useState(initial?.ico || '')
  const router = useRouter()
  const supabase = createClient()
  const { refreshSuppliers } = useActiveSupplier()
  const isEdit = !!supplierId

  function updateField(field: keyof SupplierFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function lookupICO() {
    const sanitized = icoInput.replace(/\s/g, '')
    setIcoInput(sanitized)
    if (!sanitized || sanitized.length < 6) {
      toast.error('Zadajte platné IČO (min. 6 znakov)')
      return
    }
    setLookingUp(true)
    console.log('[v0] lookupICO started for:', sanitized)
    try {
      const res = await fetch(`/api/rpo?ico=${sanitized}`)
      const data = await res.json()
      console.log('[v0] RUZ API response:', res.ok, data)
      if (res.ok) {
        console.log('[v0] Updating form with data:', {
          ico: data.ico,
          company_name: data.company_name,
          dic: data.dic,
          ic_dph: data.ic_dph,
          street: data.street,
          city: data.city,
          postal_code: data.postal_code,
        })
        setForm((prev) => {
          const newForm = {
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
          }
          console.log('[v0] New form state:', newForm)
          return newForm
        })
        toast.success('Udaje boli nacitane z registra')
      } else {
        toast.error(data.error || 'Nepodarilo sa nacitat udaje')
      }
    } catch (err) {
      console.error('[v0] lookupICO error:', err)
      toast.error('Chyba pri komunikacii so serverom')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSave() {
    if (!form.company_name || !form.ico) {
      toast.error('Názov firmy a IČO sú povinné')
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
        ; ({ error } = await supabase.from('suppliers').update(payload).eq('id', supplierId))
      } else {
        ; ({ error } = await supabase.from('suppliers').insert(payload))
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
          <h2 className="font-semibold text-foreground">Vyhľadanie podľa IČO</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={icoInput}
            onChange={(e) => setIcoInput(e.target.value)}
            placeholder="Zadajte IČO (napr. 36421928)"
            className="glass-input flex-1 px-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
            maxLength={10}
          />
          <button
            onClick={lookupICO}
            disabled={lookingUp}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lookingUp ? 'Hľadám...' : 'Vyhladať'}
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
          <h2 className="font-semibold text-foreground">Údaje o firme</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Názov firmy *" value={form.company_name} onChange={(v) => updateField('company_name', v)} />
          <Field label="IČO" value={form.ico} onChange={(v) => updateField('ico', v)} />
          <Field label="DIČ" value={form.dic} onChange={(v) => updateField('dic', v)} />
          {form.is_vat_payer && (
            <Field label="IČ DPH" value={form.ic_dph} onChange={(v) => updateField('ic_dph', v)} />
          )}
          <Field label="Ulica" value={form.street} onChange={(v) => updateField('street', v)} />
          <Field label="Mesto" value={form.city} onChange={(v) => updateField('city', v)} />
          <Field label="PSČ" value={form.postal_code} onChange={(v) => updateField('postal_code', v)} />
          <Field label="Krajina" value={form.country_code} onChange={(v) => updateField('country_code', v)} />
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
                  ? 'Faktúry budú vystavené s DPH a rekapituláciou dane'
                  : 'Faktúry budú vystavené bez DPH (dodávateľ nie je platcom DPH)'
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
          <h2 className="font-semibold text-foreground">Platobné údaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Názov banky" value={form.bank_name} onChange={(v) => updateField('bank_name', v)} />
          <IbanField value={form.iban} onChange={(v) => updateField('iban', v)} />
          <Field label="SWIFT/BIC" value={form.swift} onChange={(v) => updateField('swift', v)} />
        </div>
      </GlassCard>

      {/* Contact Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Kontaktné údaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="E-mail" value={form.email} onChange={(v) => updateField('email', v)} type="email" />
          <Field label="Telefon" value={form.phone} onChange={(v) => updateField('phone', v)} type="tel" />
          <Field label="Web stránka" value={form.web} onChange={(v) => updateField('web', v)} className="md:col-span-2" />
        </div>
      </GlassCard>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {isEdit && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Zmazať dodávateľa
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.company_name || !form.ico}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Uložiť zmeny' : 'Vytvoriť dodávateľa'}
        </button>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Zmazat dodavatela"
        description="Naozaj chcete zmazat tohto dodavatela? Vsetky jeho faktury zostanu zachovane."
        confirmLabel="Zmazat"
        variant="danger"
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete() }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
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

function IbanField({ value, onChange }: { value: string | null | undefined; onChange: (v: string) => void }) {
  const [touched, setTouched] = useState(false)
  const display = formatIban(cleanIban(value || ''))
  const result = validateIban(value || '')
  const hasError = touched && result.cleaned.length > 0 && !result.valid

  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1.5">IBAN</label>
      <input
        type="text"
        value={display}
        onChange={(e) => onChange(cleanIban(e.target.value))}
        onBlur={() => setTouched(true)}
        className={`glass-input w-full px-4 py-2.5 rounded-xl font-mono text-sm tracking-wider ${result.valid && result.cleaned.length > 0
            ? 'text-emerald-400 ring-1 ring-emerald-500/30'
            : hasError
              ? 'text-destructive ring-2 ring-destructive'
              : 'text-foreground'
          }`}
        placeholder="SK89 7500 0000 0001 2345 671"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="flex items-center justify-between mt-1">
        {hasError && result.error ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {result.error}
          </p>
        ) : result.valid && result.cleaned.length > 0 ? (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            IBAN platny ({result.country})
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {result.expectedLength
              ? `${result.cleaned.length} / ${result.expectedLength}`
              : result.cleaned.length > 0
                ? `${result.cleaned.length} znakov`
                : 'Zadajte IBAN'}
          </p>
        )}
        {result.country && result.cleaned.length >= 2 && (
          <span className="text-xs text-muted-foreground font-medium">{result.country}</span>
        )}
      </div>
    </div>
  )
}
