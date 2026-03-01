'use client'

import { GlassCard } from '@/components/glass-card'
import { CalendarDays, FileText, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { cleanIban, formatIban, validateIban } from '@/lib/iban'

const paymentMethods = [
  { value: '30', label: 'Bankovy prevod' },
  { value: '58', label: 'SEPA prevod' },
  { value: '48', label: 'Platba kartou' },
  { value: '10', label: 'Hotovost' },
  { value: '42', label: 'Na ucet' },
  { value: '1', label: 'Nezadane / ine' },
]

const bankTransferCodes = ['30', '58']

import type { InvoiceFormData } from '@/lib/schemas'

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
}

export function StepBasicInfo({ formData, updateForm }: Props) {
  const needsIban = bankTransferCodes.includes(formData.payment_means_code)
  const [ibanTouched, setIbanTouched] = useState(false)

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
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Zakladne udaje faktury</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Cislo faktury *
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
              Automaticky generovane, mozete zmenit
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
              <option value="CZK">CZK - Ceska koruna</option>
              <option value="USD">USD - Americky dolar</option>
              <option value="GBP">GBP - Britska libra</option>
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Forma uhrady</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Sposob platby</label>
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
            <label className="block text-sm text-muted-foreground mb-1.5">Variabilny symbol</label>
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
                  Pre bankovy prevod je IBAN povinny (BR-61). Vyplnte ho tu alebo v profile dodavatela.
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
                  IBAN je platny ({ibanResult.country})
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
                        : 'Zadajte IBAN v lubovolnom formate'}
                  </p>
                  {ibanResult.country && ibanResult.cleaned.length >= 2 && (
                    <p className="text-xs text-muted-foreground font-medium">{ibanResult.country}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Nazov banky</label>
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
          <h2 className="font-semibold text-foreground">Datumy</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Datum vystavenia *
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
              Datum splatnosti *
            </label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => updateForm({ due_date: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Datum dodania
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
              Referencia objednavky
            </label>
            <input
              type="text"
              value={formData.order_reference || ''}
              onChange={(e) => updateForm({ order_reference: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Cislo objednavky"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Referencia odberatela
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
              Poznamka na fakture
            </label>
            <textarea
              value={formData.note || ''}
              onChange={(e) => updateForm({ note: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground resize-none"
              rows={2}
              placeholder="Volitelna poznamka..."
            />
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
