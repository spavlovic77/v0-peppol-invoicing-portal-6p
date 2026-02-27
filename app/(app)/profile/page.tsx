'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Search, Save, Building2, CreditCard, Globe, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/glass-card'
import type { CompanyProfile } from '@/lib/schemas'

type ProfileData = CompanyProfile & { id?: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Partial<ProfileData>>({
    country_code: 'SK',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [icoInput, setIcoInput] = useState('')
  const supabase = createClient()

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      setProfile(data)
      setIcoInput(data.ico || '')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

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
        setProfile((prev) => ({
          ...prev,
          ico: data.ico,
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

  async function saveProfile() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nie ste prihlaseny'); return }

      const profileData = {
        id: user.id,
        ico: profile.ico || icoInput,
        company_name: profile.company_name || '',
        dic: profile.dic || null,
        ic_dph: profile.ic_dph || null,
        street: profile.street || null,
        city: profile.city || null,
        postal_code: profile.postal_code || null,
        country_code: profile.country_code || 'SK',
        bank_name: profile.bank_name || null,
        iban: profile.iban || null,
        swift: profile.swift || null,
        email: profile.email || null,
        phone: profile.phone || null,
        web: profile.web || null,
        registration_court: profile.registration_court || null,
        registration_number: profile.registration_number || null,
      }

      const { error } = await supabase
        .from('company_profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (error) {
        toast.error('Chyba pri ukladani: ' + error.message)
      } else {
        toast.success('Profil bol ulozeny')
      }
    } catch {
      toast.error('Neocakavana chyba')
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof ProfileData, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Firemny profil</h1>
        <p className="text-muted-foreground mt-1">
          Tieto udaje budu pouzite ako dodavatel na vasich fakturach
        </p>
      </div>

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
            maxLength={8}
          />
          <button
            onClick={lookupICO}
            disabled={lookingUp}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Vyhladat
          </button>
        </div>
      </GlassCard>

      {/* Company Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Udaje o firme</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Nazov firmy *" value={profile.company_name} onChange={(v) => updateField('company_name', v)} />
          <FormField label="ICO" value={profile.ico} onChange={(v) => updateField('ico', v)} />
          <FormField label="DIC" value={profile.dic} onChange={(v) => updateField('dic', v)} />
          <FormField label="IC DPH" value={profile.ic_dph} onChange={(v) => updateField('ic_dph', v)} />
          <FormField label="Ulica" value={profile.street} onChange={(v) => updateField('street', v)} />
          <FormField label="Mesto" value={profile.city} onChange={(v) => updateField('city', v)} />
          <FormField label="PSC" value={profile.postal_code} onChange={(v) => updateField('postal_code', v)} />
          <FormField label="Krajina" value={profile.country_code} onChange={(v) => updateField('country_code', v)} />
          <FormField label="Registracny sud" value={profile.registration_court} onChange={(v) => updateField('registration_court', v)} className="md:col-span-2" />
          <FormField label="Cislo zapisu" value={profile.registration_number} onChange={(v) => updateField('registration_number', v)} className="md:col-span-2" />
        </div>
      </GlassCard>

      {/* Payment Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Platobne udaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Nazov banky" value={profile.bank_name} onChange={(v) => updateField('bank_name', v)} />
          <FormField label="IBAN" value={profile.iban} onChange={(v) => updateField('iban', v)} />
          <FormField label="SWIFT/BIC" value={profile.swift} onChange={(v) => updateField('swift', v)} />
        </div>
      </GlassCard>

      {/* Contact Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Kontaktne udaje</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="E-mail" value={profile.email} onChange={(v) => updateField('email', v)} type="email" />
          <FormField label="Telefon" value={profile.phone} onChange={(v) => updateField('phone', v)} type="tel" />
          <FormField label="Web stranka" value={profile.web} onChange={(v) => updateField('web', v)} className="md:col-span-2" />
        </div>
      </GlassCard>

      {/* Peppol ID Preview */}
      {profile.dic && (
        <GlassCard className="border-primary/20">
          <div className="text-sm text-muted-foreground mb-1">Vase Peppol ID</div>
          <div className="text-lg font-mono font-semibold text-primary">
            0245:{profile.dic}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Schema 0245 (Slovensko) + DIC
          </div>
        </GlassCard>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveProfile}
          disabled={saving || !profile.company_name || !profile.ico}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Ulozit profil
        </button>
      </div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  label: string
  value: string | null | undefined
  onChange: (v: string) => void
  type?: string
  className?: string
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
