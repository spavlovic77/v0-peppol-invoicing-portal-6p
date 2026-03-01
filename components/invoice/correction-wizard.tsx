'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Ban, Hash, DollarSign, PenLine, Percent, FileText, FileX2, ChevronRight } from 'lucide-react'
import type { InvoiceFormData } from '@/lib/schemas'
import { fmtDate } from '@/lib/utils'

export type CorrectionScenario = 'full_storno' | 'quantity' | 'price' | 'vat_rate' | 'freeform'

const SK_VAT_RATES = [
  { value: 23, label: '23%' },
  { value: 19, label: '19%' },
  { value: 10, label: '10%' },
  { value: 5, label: '5%' },
  { value: 0, label: '0%' },
]

interface OriginalInvoice {
  id: string
  invoice_number: string
  issue_date: string
  buyer_name: string
  items: {
    description: string
    quantity: number
    unit: string
    unit_price: number
    vat_rate: number
    vat_category: string
    item_number: string | null
    buyer_item_number: string | null
    discount_percent: number
    discount_amount: number
    line_total: number
  }[]
}

interface Props {
  original: OriginalInvoice
  onApply: (updates: Partial<InvoiceFormData>, scenario: CorrectionScenario, docType: '380' | '381') => void
}

const scenarios = [
  {
    id: 'full_storno' as const,
    icon: Ban,
    label: 'Uplne storno',
    desc: 'Zrusenie celej faktury',
    color: 'text-red-400',
    bg: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
    bgActive: 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500/30',
  },
  {
    id: 'quantity' as const,
    icon: Hash,
    label: 'Zmena mnozstva',
    desc: 'Dobropis na rozdiel v mnozstve',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
    bgActive: 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30',
  },
  {
    id: 'price' as const,
    icon: DollarSign,
    label: 'Zmena ceny',
    desc: 'Dobropis na rozdiel v cene',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
    bgActive: 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30',
  },
  {
    id: 'vat_rate' as const,
    icon: Percent,
    label: 'Zmena sadzby DPH',
    desc: 'Nespravne pouzita sadzba dane',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
    bgActive: 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30',
  },
  {
    id: 'freeform' as const,
    icon: PenLine,
    label: 'Volna korekcia',
    desc: 'Prazdna korekcia s referencnou',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20',
    bgActive: 'bg-violet-500/20 border-violet-500/50 ring-2 ring-violet-500/30',
  },
]

export function CorrectionWizard({ original, onApply }: Props) {
  const [selected, setSelected] = useState<CorrectionScenario | null>(null)
  const [docType, setDocType] = useState<'380' | '381'>('381')

  // For quantity scenario: track new quantities per line
  const [qtyOverrides, setQtyOverrides] = useState<Record<number, number>>(
    Object.fromEntries(original.items.map((it, i) => [i, it.quantity]))
  )

  // For price scenario: track new prices per line
  const [priceOverrides, setPriceOverrides] = useState<Record<number, number>>(
    Object.fromEntries(original.items.map((it, i) => [i, it.unit_price]))
  )

  // For VAT rate scenario: track correct rate per line
  const [vatOverrides, setVatOverrides] = useState<Record<number, number>>(
    Object.fromEntries(original.items.map((it, i) => [i, it.vat_rate]))
  )

  const r2 = (n: number) => Math.round(n * 100) / 100

  function handleApply() {
    if (!selected) return

    const isCreditNote = docType === '381'
    const baseNote = `Opravna faktura k FA ${original.invoice_number}`

    // Build items based on scenario
    let correctionItems: InvoiceFormData['items']
    let reason: string

    switch (selected) {
      case 'full_storno': {
        reason = 'Uplne storno povodnej faktury'
        correctionItems = original.items.map((it, idx) => ({
          line_number: idx + 1,
          description: it.description,
          quantity: isCreditNote ? it.quantity : -it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_category: it.vat_category || 'S',
          vat_rate: it.vat_rate,
          discount_percent: it.discount_percent || 0,
          discount_amount: it.discount_amount || 0,
          line_total: isCreditNote ? it.line_total : -it.line_total,
          item_number: it.item_number,
          buyer_item_number: it.buyer_item_number,
        }))
        break
      }
      case 'quantity': {
        reason = 'Zmena mnozstva'
        correctionItems = original.items
          .map((it, idx) => {
            const originalQty = it.quantity
            const newQty = qtyOverrides[idx] ?? originalQty
            const diff = originalQty - newQty
            if (diff <= 0) return null // No reduction, skip

            const lineTotal = r2(diff * it.unit_price - (it.discount_amount ? r2(it.discount_amount * diff / originalQty) : 0))
            return {
              line_number: idx + 1,
              description: it.description,
              quantity: isCreditNote ? diff : -diff,
              unit: it.unit,
              unit_price: it.unit_price,
              vat_category: it.vat_category || 'S',
              vat_rate: it.vat_rate,
              discount_percent: 0,
              discount_amount: 0,
              line_total: isCreditNote ? lineTotal : -lineTotal,
              item_number: it.item_number,
              buyer_item_number: it.buyer_item_number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (correctionItems.length === 0) {
          correctionItems = [{ ...original.items[0], line_number: 1, quantity: isCreditNote ? 1 : -1, line_total: isCreditNote ? original.items[0].unit_price : -original.items[0].unit_price }]
        }
        // Renumber
        correctionItems = correctionItems.map((it, i) => ({ ...it, line_number: i + 1 }))
        break
      }
      case 'price': {
        reason = 'Zmena ceny'
        correctionItems = original.items
          .map((it, idx) => {
            const originalPrice = it.unit_price
            const newPrice = priceOverrides[idx] ?? originalPrice
            const priceDiff = originalPrice - newPrice
            if (priceDiff <= 0) return null // No reduction, skip

            const lineTotal = r2(it.quantity * priceDiff)
            return {
              line_number: idx + 1,
              description: `${it.description} (korekcia ceny)`,
              quantity: isCreditNote ? it.quantity : -it.quantity,
              unit: it.unit,
              unit_price: priceDiff,
              vat_category: it.vat_category || 'S',
              vat_rate: it.vat_rate,
              discount_percent: 0,
              discount_amount: 0,
              line_total: isCreditNote ? lineTotal : -lineTotal,
              item_number: it.item_number,
              buyer_item_number: it.buyer_item_number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (correctionItems.length === 0) {
          correctionItems = [{
            line_number: 1, description: 'Korekcia ceny', quantity: 1,
            unit: 'C62', unit_price: 0, vat_category: 'S', vat_rate: original.items[0]?.vat_rate || 23,
            discount_percent: 0, discount_amount: 0, line_total: 0,
            item_number: null, buyer_item_number: null,
          }]
        }
        correctionItems = correctionItems.map((it, i) => ({ ...it, line_number: i + 1 }))
        break
      }
      case 'vat_rate': {
        // VAT rate correction: for each changed line, emit two lines:
        // 1) Reversal of original at WRONG rate (negative/credit)
        // 2) Re-issue at CORRECT rate (positive)
        // The net amount is zero, but the VAT difference is corrected
        reason = 'Zmena sadzby DPH'
        const vatLines: InvoiceFormData['items'] = []
        let lineNum = 1

        for (let idx = 0; idx < original.items.length; idx++) {
          const it = original.items[idx]
          const oldRate = it.vat_rate
          const newRate = vatOverrides[idx] ?? oldRate
          if (newRate === oldRate) continue // No change

          // Line 1: reverse original at WRONG rate
          vatLines.push({
            line_number: lineNum++,
            description: `${it.description} (storno ${oldRate}% DPH)`,
            quantity: isCreditNote ? it.quantity : -it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            vat_category: it.vat_category || 'S',
            vat_rate: oldRate,
            discount_percent: it.discount_percent || 0,
            discount_amount: it.discount_amount || 0,
            line_total: isCreditNote ? it.line_total : -it.line_total,
            item_number: it.item_number,
            buyer_item_number: it.buyer_item_number,
          })

          // Line 2: re-issue at CORRECT rate (opposite sign -- adds back)
          vatLines.push({
            line_number: lineNum++,
            description: `${it.description} (spravne ${newRate}% DPH)`,
            quantity: isCreditNote ? -it.quantity : it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            vat_category: it.vat_category || 'S',
            vat_rate: newRate,
            discount_percent: it.discount_percent || 0,
            discount_amount: it.discount_amount || 0,
            line_total: isCreditNote ? -it.line_total : it.line_total,
            item_number: it.item_number,
            buyer_item_number: it.buyer_item_number,
          })
        }

        if (vatLines.length === 0) {
          // Nothing changed -- add placeholder
          vatLines.push({
            line_number: 1, description: 'Korekcia DPH', quantity: isCreditNote ? 1 : -1,
            unit: 'C62', unit_price: 0, vat_category: 'S', vat_rate: 23,
            discount_percent: 0, discount_amount: 0, line_total: 0,
            item_number: null, buyer_item_number: null,
          })
        }
        correctionItems = vatLines
        break
      }
      case 'freeform': {
        reason = 'Volna korekcia'
        correctionItems = [{
          line_number: 1, description: '', quantity: isCreditNote ? 1 : -1,
          unit: 'C62', unit_price: 0, vat_category: 'S', vat_rate: original.items[0]?.vat_rate || 23,
          discount_percent: 0, discount_amount: 0, line_total: 0,
          item_number: null, buyer_item_number: null,
        }]
        break
      }
    }

    onApply({
      items: correctionItems,
      note: baseNote,
      invoice_type_code: docType,
      correction_of: original.id,
      correction_reason: reason,
      billing_reference_number: original.invoice_number,
      billing_reference_date: original.issue_date,
    }, selected, docType)
  }

  return (
    <div className="space-y-6">
      {/* Original invoice reference */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Korekcia k fakture {original.invoice_number}</p>
            <p className="text-xs text-muted-foreground">{original.buyer_name} &middot; {fmtDate(original.issue_date)}</p>
          </div>
        </div>
      </GlassCard>

      {/* Scenario selection */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Co chcete opravit?</h2>
        <div className="grid grid-cols-2 gap-3">
          {scenarios.map((s) => {
            const Icon = s.icon
            const isActive = selected === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`flex flex-col items-center text-center p-4 rounded-xl border transition-all ${isActive ? s.bgActive : s.bg}`}
              >
                <Icon className={`w-7 h-7 mb-2 ${s.color}`} />
                <span className="text-sm font-medium text-foreground">{s.label}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{s.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quantity adjustment UI */}
      {selected === 'quantity' && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-3">Upravte mnozstva (novy stav po korekcii)</h3>
          <div className="space-y-2">
            {original.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{it.description}</p>
                  <p className="text-xs text-muted-foreground">Povodne: {it.quantity} {it.unit}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={it.quantity}
                  value={qtyOverrides[idx] ?? it.quantity}
                  onChange={(e) => setQtyOverrides((prev) => ({ ...prev, [idx]: Number(e.target.value) }))}
                  className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm text-center"
                />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Price adjustment UI */}
      {selected === 'price' && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-3">Upravte ceny (nova spravna cena)</h3>
          <div className="space-y-2">
            {original.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{it.description}</p>
                  <p className="text-xs text-muted-foreground">Povodna cena: {it.unit_price.toFixed(2)} EUR</p>
                </div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceOverrides[idx] ?? it.unit_price}
                  onChange={(e) => setPriceOverrides((prev) => ({ ...prev, [idx]: Number(e.target.value) }))}
                  className="w-24 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm text-right"
                />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* VAT rate adjustment UI */}
      {selected === 'vat_rate' && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-3">Vyberte spravnu sadzbu DPH</h3>
          <div className="space-y-2">
            {original.items.map((it, idx) => {
              const currentOverride = vatOverrides[idx] ?? it.vat_rate
              const isChanged = currentOverride !== it.vat_rate
              return (
                <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg ${isChanged ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-secondary/30'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{it.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Povodne: {it.vat_rate}%
                      {isChanged && <span className="text-emerald-400 ml-1"> &rarr; {currentOverride}%</span>}
                    </p>
                  </div>
                  <select
                    value={currentOverride}
                    onChange={(e) => setVatOverrides((prev) => ({ ...prev, [idx]: Number(e.target.value) }))}
                    className="w-24 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm text-center appearance-none"
                  >
                    {SK_VAT_RATES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Vysledkom budu 2 riadky na kazdu zmenu: storno povodnej sadzby + nova spravna sadzba. Zaklad dane zostava rovnaky, meni sa iba DPH.
          </p>
        </GlassCard>
      )}

      {/* Document type selector */}
      {selected && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Typ dokladu</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDocType('381')}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                docType === '381'
                  ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                  : 'bg-secondary/30 border-border hover:bg-secondary/50'
              }`}
            >
              <FileText className={`w-6 h-6 shrink-0 ${docType === '381' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <span className="text-sm font-medium text-foreground block">Dobropis (381)</span>
                <span className="text-xs text-muted-foreground">Kladne sumy, CreditNote</span>
              </div>
            </button>
            <button
              onClick={() => setDocType('380')}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                docType === '380'
                  ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                  : 'bg-secondary/30 border-border hover:bg-secondary/50'
              }`}
            >
              <FileX2 className={`w-6 h-6 shrink-0 ${docType === '380' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <span className="text-sm font-medium text-foreground block">Zaporna FA (380)</span>
                <span className="text-xs text-muted-foreground">Zaporne sumy, Invoice</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Apply button */}
      {selected && (
        <button
          onClick={handleApply}
          className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Pripravit korekciu
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
