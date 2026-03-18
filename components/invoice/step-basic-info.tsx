'use client'

import { GlassCard } from '@/components/glass-card'
import { CalendarDays, FileText, CreditCard, AlertTriangle, CheckCircle2, ArrowLeftRight, RefreshCw, Info } from 'lucide-react'
import { useState, useCallback } from 'react'
import { cleanIban, formatIban, validateIban } from '@/lib/iban'

const DUE_DAY_OPTIONS = [14, 30, 60, 90] as const

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const paymentMethods = [
  { value: '10', label: 'Hotovosť' },
  { value: '30', label: 'Bankový prevod' },
  { value: '42', label: 'Dobierka' },
  { value: '48', label: 'Platobná karta' },
  { value: '97', label: 'Vzájomný zápočet' },
]

const bankTransferCodes = ['30', '58']

import type { InvoiceFormData } from '@/lib/schemas'

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
  invoiceMode?: string
}

export function StepBasicInfo({ formData, updateForm, invoiceMode = 'standard' }: Props) {
  const needsIban = bankTransferCodes.includes(formData.payment_means_code)
  const [ibanTouched, setIbanTouched] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number>(14)

  // Live IBAN display: show formatted value in the input
  const ibanDisplay = formatIban(cleanIban(formData.iban || ''))
  const ibanResult = validateIban(formData.iban || '')
  const ibanMissing = needsIban && !ibanResult.cleaned
  const ibanHasError = needsIban && ibanTouched && ibanResult.cleaned.length > 0 && !ibanResult.valid

  const handleIbanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Store the cleaned value (no spaces, uppercase) in formData
    const cleaned = cleanIban(e.target.value)
    updateForm({ iban: cleaned || null })
    if (!ibanTouched) setIbanTouched(true)
  }, [updateForm, ibanTouched])
  return (
    <div className="space-y-6">
      {invoiceMode === 'selfbilling' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
          <ArrowLeftRight className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Samofakturacia (InvoiceTypeCode 389)</p>
            <p className="text-muted-foreground mt-0.5">
              Vy ako odberatel vystavujete fakturu v mene dodavatela. Role su prehodene: dodavatel = AccountingSupplierParty, vy = AccountingCustomerParty.
            </p>
          </div>
        </div>
      )}
      {invoiceMode === 'reversecharge' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <RefreshCw className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Prenesenie danovej povinnosti (Reverse charge)</p>
            <p className="text-muted-foreground mt-0.5">
              DPH = 0% na vsetkych polozkach, kategoria AE. Podla §69 ods. 12 zakona o DPH a EN16931 pravidla BR-AE-05.
            </p>
          </div>
        </div>
      )}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Základné údaje faktúry</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Číslo faktúry *
            </label>
            <input
              id="invoice_number"
              type="text"
              value={formData.invoice_number}
              onChange={(e) => updateForm({ invoice_number: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="FV-2026-0001"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Automaticky generované, môžete zmeniť
            </p>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Mena</label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => updateForm({ currency: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            >
              <option value="EUR">EUR - Euro</option>
              <option value="CZK">CZK - Česká koruna</option>
              <option value="USD">USD - Americký dolár</option>
              <option value="GBP">GBP - Britská libra</option>
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Forma úhrady</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Spôsob platby</label>
            <select
              value={formData.payment_means_code}
              onChange={(e) => updateForm({ payment_means_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            >
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Variabilný symbol</label>
            <input
              type="text"
              value={formData.variable_symbol || ''}
              onChange={(e) => updateForm({ variable_symbol: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Variabilny symbol"
            />
          </div>
        </div>

        {/* IBAN + Bank fields (shown when payment means requires bank transfer) */}
        {needsIban && (
          <div className="mt-4 space-y-3">
            {/* Warning: IBAN missing */}
            {ibanMissing && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  Pre bankový prevod je IBAN povinný (BR-61). Vyplňte ho tu alebo v profile dodávateľa.
                </p>
              </div>
            )}

            {/* Error: IBAN invalid format / checksum */}
            {ibanHasError && ibanResult.error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{ibanResult.error}</p>
              </div>
            )}

            {/* Success: IBAN valid */}
            {ibanResult.valid && ibanResult.cleaned.length > 0 && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-400">
                  IBAN je platný ({ibanResult.country})
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">IBAN *</label>
                <input
                  id="iban"
                  type="text"
                  value={ibanDisplay}
                  onChange={handleIbanChange}
                  onBlur={() => setIbanTouched(true)}
                  className={`glass-input w-full px-4 py-2.5 rounded-xl font-mono text-sm tracking-wider ${
                    ibanResult.valid && ibanResult.cleaned.length > 0
                      ? 'text-emerald-400 ring-1 ring-emerald-500/30'
                      : ibanHasError
                        ? 'text-destructive ring-2 ring-destructive'
                        : 'text-foreground'
                  }`}
                  placeholder="SK89 7500 0000 0001 2345 671"
                  autoComplete="off"
                  spellCheck={false}
                />
                {/* Character counter */}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {ibanResult.expectedLength
                      ? `${ibanResult.cleaned.length} / ${ibanResult.expectedLength} znakov`
                      : ibanResult.cleaned.length > 0
                        ? `${ibanResult.cleaned.length} znakov`
                        : 'Zadajte IBAN v ľubovoľnom formáte'}
                  </p>
                  {ibanResult.country && ibanResult.cleaned.length >= 2 && (
                    <p className="text-xs text-muted-foreground font-medium">{ibanResult.country}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Názov banky</label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => updateForm({ bank_name: e.target.value || null })}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
                  placeholder="Nazov banky"
                />
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Dátumy</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Dátum vyhotovenia *
            </label>
            <input
              id="issue_date"
              type="date"
              value={formData.issue_date}
              onChange={(e) => updateForm({ issue_date: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Dátum splatnosti *
            </label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => {
                updateForm({ due_date: e.target.value })
                // Calculate which preset matches (if any)
                if (formData.issue_date && e.target.value) {
                  const diff = Math.round((new Date(e.target.value).getTime() - new Date(formData.issue_date).getTime()) / 86400000)
                  const match = DUE_DAY_OPTIONS.find(d => d === diff)
                  setSelectedDays(match ?? 0)
                }
              }}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
            {/* Day preset slider */}
            <div className="flex items-center gap-1 mt-2">
              {DUE_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDays(d)
                    if (formData.issue_date) {
                      updateForm({ due_date: addDays(formData.issue_date, d) })
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedDays === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {d} dní
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Dátum dodania
            </label>
            <input
              type="date"
              value={formData.delivery_date || ''}
              onChange={(e) => updateForm({ delivery_date: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Referencia objednávky
            </label>
            <input
              type="text"
              value={formData.order_reference || ''}
              onChange={(e) => updateForm({ order_reference: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Číslo objednávky"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Referencia odberateľa
            </label>
            <input
              id="buyer_reference"
              type="text"
              value={formData.buyer_reference || ''}
              onChange={(e) => updateForm({ buyer_reference: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Referencia odberatela"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted-foreground mb-1.5">
              Poznámka na faktúre
              {invoiceMode === 'reversecharge' && <span className="text-amber-500 ml-1">(povinné pri prenesení DPH)</span>}
            </label>
            <textarea
              value={formData.note || ''}
              onChange={(e) => {
                if (invoiceMode === 'reversecharge') {
                  // Keep mandatory text, allow appending
                  const mandatory = 'Prenesenie daňovej povinnosti'
                  const val = e.target.value
                  if (!val.startsWith(mandatory)) {
                    updateForm({ note: mandatory })
                    return
                  }
                  updateForm({ note: val || mandatory })
                } else {
                  updateForm({ note: e.target.value || null })
                }
              }}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground resize-none"
              rows={2}
              placeholder={invoiceMode === 'reversecharge' ? 'Prenesenie daňovej povinnosti' : 'Voliteľná poznámka...'}
            />
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
