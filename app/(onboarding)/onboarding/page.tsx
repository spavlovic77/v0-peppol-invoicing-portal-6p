'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlassCard } from '@/components/glass-card'
import { FileText, Search, Loader2, CheckCircle2, ArrowRight, Building2 } from 'lucide-react'

type Phase = 'idle' | 'searching' | 'found' | 'saving' | 'done' | 'error'

interface CompanyData {
  ico: string
  company_name: string
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country_code: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [ico, setIco] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = ico.trim()
    if (!trimmed || trimmed.length < 6) {
      setErrorMsg('ICO musi mat aspon 6 cifier')
      return
    }

    setPhase('searching')
    setErrorMsg('')
    setCompany(null)

    try {
      const res = await fetch(`/api/rpo?ico=${encodeURIComponent(trimmed)}`)
      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setErrorMsg(data.error || 'ICO nenajdene v registri')
        return
      }

      setCompany(data)
      setPhase('found')

      // Auto-save after brief visual confirmation
      setTimeout(() => saveCompany(data), 800)
    } catch {
      setPhase('error')
      setErrorMsg('Chyba pripojenia. Skuste to znova.')
    }
  }

  async function saveCompany(data: CompanyData, iban?: string) {
    setPhase('saving')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Save to company_profiles (for billing the user)
      await supabase.from('company_profiles').upsert({
        id: user.id,
        ico: data.ico,
        dic: data.dic,
        ic_dph: data.ic_dph,
        company_name: data.company_name,
        street: data.street,
        city: data.city,
        postal_code: data.postal_code,
        country_code: data.country_code,
      })

      // Create first supplier
      await supabase.from('suppliers').insert({
        user_id: user.id,
        ico: data.ico,
        dic: data.dic,
        ic_dph: data.ic_dph,
        company_name: data.company_name,
        street: data.street,
        city: data.city,
        postal_code: data.postal_code,
        country_code: data.country_code,
        is_vat_payer: !!data.ic_dph,
        ...(iban ? { iban } : {}),
      })

      setPhase('done')
      setTimeout(() => router.push('/dashboard'), 600)
    } catch {
      setPhase('error')
      setErrorMsg('Nepodarilo sa ulozit udaje. Skuste to znova.')
    }
  }

  const DEMO_ICO = '36353582'
  const DEMO_IBAN = 'SK7611000000002615898434'

  async function handleUseDemo() {
    setIco(DEMO_ICO)
    setPhase('searching')
    setErrorMsg('')
    setCompany(null)

    try {
      const res = await fetch(`/api/rpo?ico=${DEMO_ICO}`)
      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setErrorMsg(data.error || 'Demo ICO nenajdene v registri')
        return
      }

      setCompany(data)
      setPhase('found')
      setTimeout(() => saveCompany(data, DEMO_IBAN), 800)
    } catch {
      setPhase('error')
      setErrorMsg('Chyba pripojenia. Skuste to znova.')
    }
  }

  const isProcessing = phase === 'searching' || phase === 'saving'

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-balance">
            Vitajte
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Zadajte IČO vašej spoločnosti a automaticky dohľadáme všetky údaje
          </p>
        </div>

        {/* Main card */}
        <GlassCard heavy className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ico" className="block text-sm font-medium text-foreground mb-2">
                IČO spoločnosti
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  id="ico"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={ico}
                  onChange={(e) => {
                    setIco(e.target.value.replace(/\D/g, ''))
                    if (phase === 'error') setPhase('idle')
                  }}
                  placeholder="napr. 36421928"
                  disabled={isProcessing || phase === 'done'}
                  className="glass-input w-full pl-12 pr-4 py-4 rounded-xl text-foreground text-lg sm:text-xl font-mono tracking-wider text-center placeholder:text-muted-foreground/50 placeholder:tracking-normal placeholder:font-sans placeholder:text-base disabled:opacity-50"
                  autoComplete="off"
                />
              </div>
              {errorMsg && (
                <p className="text-destructive text-sm mt-2">{errorMsg}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!ico.trim() || ico.trim().length < 6 || isProcessing || phase === 'done'}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base sm:text-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {phase === 'searching' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Hľadám v registri...
                </>
              ) : phase === 'saving' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ukladam...
                </>
              ) : phase === 'done' ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Hotovo!
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Vyhľadať a pokračovať
                </>
              )}
            </button>
          </form>

          {/* Success -- company found */}
          {company && (phase === 'found' || phase === 'saving' || phase === 'done') && (
            <div className="rounded-xl bg-success/10 border border-success/20 p-4 space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <span className="font-semibold text-foreground">{company.company_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground ml-7">
                <span>ICO: {company.ico}</span>
                {company.dic && <span>DIC: {company.dic}</span>}
                {company.ic_dph && <span>IC DPH: {company.ic_dph}</span>}
                {company.city && <span>{company.street}, {company.city}</span>}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Demo account option */}
        {phase !== 'done' && (
          <div className="text-center">
            <button
              onClick={() => handleUseDemo()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Building2 className="w-3.5 h-3.5" />
              Alebo použite demo účet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
