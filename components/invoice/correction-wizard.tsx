'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Ban, Hash, DollarSign, PenLine, Percent, FileText, ChevronRight, Tag, Info, Loader2, AlertCircle } from 'lucide-react'
import type { InvoiceFormData } from '@/lib/schemas'
import { fmtDate } from '@/lib/utils'

export type CorrectionScenario = 'full_storno' | 'quantity' | 'price' | 'vat_rate' | 'discount' | 'freeform'

const UNIT_MAP: Record<string, string> = {
  C62: 'ks', HUR: 'hod', DAY: 'deň', MON: 'mes', KGM: 'kg',
  MTR: 'm', LTR: 'l', MTK: 'm²', MTQ: 'm³', KMT: 'km',
  TNE: 't', SET: 'sada', XPK: 'bal',
}
function unitLabel(code: string): string { return UNIT_MAP[code] || code }

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
  buyer_ico: string
  buyer_dic: string
  buyer_ic_dph: string
  buyer_street: string
  buyer_city: string
  buyer_postal_code: string
  buyer_country_code: string
  buyer_email: string
  buyer_peppol_id: string
  buyer_reference: string
  order_reference: string
  delivery_date: string
  note: string
  payment_means_code: string
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

// Non-financial editable fields for "Zmena údajov" (re-issued 380)
interface EditableFields {
  buyer_name: string
  buyer_ico: string
  buyer_dic: string
  buyer_ic_dph: string
  buyer_street: string
  buyer_city: string
  buyer_postal_code: string
  buyer_country_code: string
  buyer_email: string
  buyer_peppol_id: string
  buyer_reference: string
  order_reference: string
  delivery_date: string
  note: string
}

const FIELD_LABELS: Record<keyof EditableFields, string> = {
  buyer_name: 'Názov odberateľa',
  buyer_ico: 'IČO odberateľa',
  buyer_dic: 'DIČ odberateľa',
  buyer_ic_dph: 'IČ DPH odberateľa',
  buyer_street: 'Ulica odberateľa',
  buyer_city: 'Mesto odberateľa',
  buyer_postal_code: 'PSČ odberateľa',
  buyer_country_code: 'Krajina odberateľa',
  buyer_email: 'Email odberateľa',
  buyer_peppol_id: 'Peppol ID odberateľa',
  buyer_reference: 'Referencia odberateľa',
  order_reference: 'Číslo objednávky',
  delivery_date: 'Dátum dodania',
  note: 'Poznámka',
}

interface Props {
  original: OriginalInvoice
  onApply: (updates: Partial<InvoiceFormData>, scenario: CorrectionScenario, docType: '380' | '381' | '384') => void
  onDirectCreate?: (updates: Partial<InvoiceFormData>, scenario: CorrectionScenario, docType: '381') => Promise<{ success: boolean; errors?: string[] }>
  isCreating?: boolean
  creationErrors?: string[]
}

const scenarios = [
  {
    id: 'full_storno' as const,
    icon: Ban,
    label: 'Úplné storno',
    desc: 'Zrušenie celej faktúry',
    color: 'text-red-400',
    bg: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
    bgActive: 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500/30',
  },
  {
    id: 'quantity' as const,
    icon: Hash,
    label: 'Zmena množstva',
    desc: 'Dobropis na rozdiel v množstve',
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
    desc: 'Nesprávne použitá sadzba dane',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
    bgActive: 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30',
  },
  {
    id: 'discount' as const,
    icon: Tag,
    label: 'Poskytnutie zľavy',
    desc: 'Dobropis na zľavu z položiek',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20',
    bgActive: 'bg-pink-500/20 border-pink-500/50 ring-2 ring-pink-500/30',
  },
  {
    id: 'freeform' as const,
    icon: PenLine,
    label: 'Zmena údajov',
    desc: 'Opravná faktúra (384)',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20',
    bgActive: 'bg-violet-500/20 border-violet-500/50 ring-2 ring-violet-500/30',
  },
]

export function CorrectionWizard({ original, onApply, onDirectCreate, isCreating, creationErrors }: Props) {
  const [selected, setSelected] = useState<CorrectionScenario | null>(null)
  // freeform (Zmena údajov) uses 384 (corrective invoice per EN16931/Peppol BIS 3.0)
  // all other scenarios use 381 (credit note)
  const docType = selected === 'freeform' ? '384' as const : '381' as const

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

  // For discount scenario: per-line discount percentage
  const [discountPercents, setDiscountPercents] = useState<Record<number, number>>(
    Object.fromEntries(original.items.map((_it, i) => [i, 0]))
  )
  // For discount scenario: apply same % to all lines
  const [uniformDiscount, setUniformDiscount] = useState(0)

  // For freeform (Zmena údajov): editable item descriptions
  const [itemDescOverrides, setItemDescOverrides] = useState<Record<number, string>>(
    Object.fromEntries(original.items.map((it, i) => [i, it.description]))
  )

  // For freeform (Zmena údajov): editable non-financial fields
  const [freeformFields, setFreeformFields] = useState<EditableFields>({
    buyer_name: original.buyer_name || '',
    buyer_ico: original.buyer_ico || '',
    buyer_dic: original.buyer_dic || '',
    buyer_ic_dph: original.buyer_ic_dph || '',
    buyer_street: original.buyer_street || '',
    buyer_city: original.buyer_city || '',
    buyer_postal_code: original.buyer_postal_code || '',
    buyer_country_code: original.buyer_country_code || 'SK',
    buyer_email: original.buyer_email || '',
    buyer_peppol_id: original.buyer_peppol_id || '',
    buyer_reference: original.buyer_reference || '',
    order_reference: original.order_reference || '',
    delivery_date: original.delivery_date || '',
    note: original.note || '',
  })

  // Compute which freeform fields were changed
  const freeformChanges: { label: string; from: string; to: string }[] = []
  if (selected === 'freeform') {
    for (const key of Object.keys(FIELD_LABELS) as (keyof EditableFields)[]) {
      const origVal = (original[key] as string) || ''
      const newVal = freeformFields[key] || ''
      if (origVal !== newVal) {
        freeformChanges.push({ label: FIELD_LABELS[key], from: origVal, to: newVal })
      }
    }
    // Item description changes
    original.items.forEach((it, idx) => {
      const newDesc = itemDescOverrides[idx] ?? it.description
      if (newDesc !== it.description) {
        freeformChanges.push({ label: `Položka ${idx + 1} (názov)`, from: it.description, to: newDesc })
      }
    })
  }

  const r2 = (n: number) => Math.round(n * 100) / 100

  function handleApply() {
    if (!selected) return

    const baseNote = selected === 'freeform'
      ? `Opravená faktúra nahradzujúca FA ${original.invoice_number}`
      : `Dobropis k FA ${original.invoice_number}`

    // Build items based on scenario
    let correctionItems: InvoiceFormData['items']
    let reason: string

    switch (selected) {
      case 'full_storno': {
        reason = 'Úplné storno pôvodnej faktúry'
        correctionItems = original.items.map((it, idx) => ({
          line_number: idx + 1,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_category: it.vat_category || 'S',
          vat_rate: it.vat_rate,
          discount_percent: it.discount_percent || 0,
          discount_amount: it.discount_amount || 0,
          line_total: it.line_total,
          item_number: it.item_number,
          buyer_item_number: it.buyer_item_number,
        }))
        break
      }
      case 'quantity': {
        reason = 'Zmena množstva'
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
              quantity: diff,
              unit: it.unit,
              unit_price: it.unit_price,
              vat_category: it.vat_category || 'S',
              vat_rate: it.vat_rate,
              discount_percent: 0,
              discount_amount: 0,
              line_total: lineTotal,
              item_number: it.item_number,
              buyer_item_number: it.buyer_item_number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (correctionItems.length === 0) {
          correctionItems = [{ ...original.items[0], line_number: 1, quantity: 1, line_total: original.items[0].unit_price }]
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
              quantity: it.quantity,
              unit: it.unit,
              unit_price: priceDiff,
              vat_category: it.vat_category || 'S',
              vat_rate: it.vat_rate,
              discount_percent: 0,
              discount_amount: 0,
              line_total: lineTotal,
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
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            vat_category: it.vat_category || 'S',
            vat_rate: oldRate,
            discount_percent: it.discount_percent || 0,
            discount_amount: it.discount_amount || 0,
            line_total: it.line_total,
            item_number: it.item_number,
            buyer_item_number: it.buyer_item_number,
          })

          // Line 2: re-issue at CORRECT rate (opposite sign -- adds back)
          vatLines.push({
            line_number: lineNum++,
            description: `${it.description} (spravne ${newRate}% DPH)`,
            quantity: -it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            vat_category: it.vat_category || 'S',
            vat_rate: newRate,
            discount_percent: it.discount_percent || 0,
            discount_amount: it.discount_amount || 0,
            line_total: -it.line_total,
            item_number: it.item_number,
            buyer_item_number: it.buyer_item_number,
          })
        }

        if (vatLines.length === 0) {
          // Nothing changed -- add placeholder
          vatLines.push({
            line_number: 1, description: 'Korekcia DPH', quantity: 1,
            unit: 'C62', unit_price: 0, vat_category: 'S', vat_rate: 23,
            discount_percent: 0, discount_amount: 0, line_total: 0,
            item_number: null, buyer_item_number: null,
          })
        }
        correctionItems = vatLines
        break
      }
      case 'discount': {
        reason = 'Poskytnutie zľavy'
        correctionItems = original.items
          .map((it, idx) => {
            const pct = discountPercents[idx] ?? 0
            if (pct <= 0) return null
            const discountAmount = r2(it.line_total * pct / 100)
            // Use quantity=1 to avoid rounding errors in BR-25 (line_total must == qty * price - discount)
            return {
              line_number: idx + 1,
              description: `${it.description} (zľava ${pct}%)`,
              quantity: 1,
              unit: 'C62',
              unit_price: discountAmount,
              vat_category: it.vat_category || 'S',
              vat_rate: it.vat_rate,
              discount_percent: 0,
              discount_amount: 0,
              line_total: discountAmount,
              item_number: it.item_number,
              buyer_item_number: it.buyer_item_number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        if (correctionItems.length === 0) {
          correctionItems = [{
            line_number: 1, description: 'Zľava', quantity: 1,
            unit: 'C62', unit_price: 0, vat_category: 'S', vat_rate: original.items[0]?.vat_rate || 23,
            discount_percent: 0, discount_amount: 0, line_total: 0,
            item_number: null, buyer_item_number: null,
          }]
        }
        correctionItems = correctionItems.map((it, i) => ({ ...it, line_number: i + 1 }))
        break
      }
      case 'freeform': {
        const changeDescriptions = freeformChanges.map(c =>
          `${c.label}: "${c.from || '(prázdne)'}" → "${c.to || '(prázdne)'}"`
        )
        reason = changeDescriptions.length > 0
          ? `Zmena údajov: ${changeDescriptions.join('; ')}`
          : 'Zmena údajov'
        // Re-issued invoice with original items at real values but updated descriptions
        correctionItems = original.items.map((it, idx) => ({
          line_number: idx + 1,
          description: itemDescOverrides[idx] ?? it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_category: it.vat_category || 'S',
          vat_rate: it.vat_rate,
          discount_percent: it.discount_percent || 0,
          discount_amount: it.discount_amount || 0,
          line_total: it.line_total,
          item_number: it.item_number,
          buyer_item_number: it.buyer_item_number,
        }))
        break
      }
    }

    // For freeform (380 re-issue), also include the corrected non-financial fields
    const freeformUpdates: Partial<InvoiceFormData> = selected === 'freeform' ? {
      buyer_name: freeformFields.buyer_name,
      buyer_ico: freeformFields.buyer_ico,
      buyer_dic: freeformFields.buyer_dic,
      buyer_ic_dph: freeformFields.buyer_ic_dph,
      buyer_street: freeformFields.buyer_street,
      buyer_city: freeformFields.buyer_city,
      buyer_postal_code: freeformFields.buyer_postal_code,
      buyer_country_code: freeformFields.buyer_country_code,
      buyer_email: freeformFields.buyer_email,
      buyer_peppol_id: freeformFields.buyer_peppol_id,
      buyer_reference: freeformFields.buyer_reference,
      order_reference: freeformFields.order_reference,
      delivery_date: freeformFields.delivery_date,
      note: `${baseNote}\n${freeformFields.note || ''}`.trim(),
    } : {}

    const updates: Partial<InvoiceFormData> = {
      items: correctionItems,
      note: baseNote,
      invoice_type_code: docType,
      correction_of: original.id,
      correction_reason: reason,
      billing_reference_number: original.invoice_number,
      billing_reference_date: original.issue_date,
      ...freeformUpdates,
    }

    // For full_storno, use direct creation if available (skip form, create immediately)
    if (selected === 'full_storno' && onDirectCreate) {
      onDirectCreate(updates, selected, '381')
      return
    }

    onApply(updates, selected, docType)
  }

  return (
    <div className="space-y-6">
      {/* Original invoice reference */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Oprava k faktúre {original.invoice_number}</p>
            <p className="text-xs text-muted-foreground">{original.buyer_name} &middot; {fmtDate(original.issue_date)}</p>
          </div>
        </div>
      </GlassCard>

      {/* Scenario selection */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Čo chcete opraviť?</h2>
        <div className="grid grid-cols-2 gap-3">
          {scenarios.map((s) => {
            const Icon = s.icon
            const isActive = selected === s.id
            const isDisabled = s.id === 'vat_rate'
            return (
              <div key={s.id} className="relative">
                <button
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setSelected(s.id)}
                  className={`flex flex-col items-center text-center p-4 rounded-xl border transition-all w-full ${isDisabled ? 'opacity-40 cursor-not-allowed bg-secondary/20 border-border/30' : isActive ? s.bgActive : s.bg}`}
                >
                  <Icon className={`w-7 h-7 mb-2 ${isDisabled ? 'text-muted-foreground/50' : s.color}`} />
                  <span className={`text-sm font-medium ${isDisabled ? 'text-muted-foreground/50' : 'text-foreground'}`}>{s.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{s.desc}</span>
                </button>
                {isDisabled && (
                  <div className="flex items-start gap-1.5 mt-1.5 px-1">
                    <Info className="w-3 h-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-muted-foreground/60 leading-tight">{'Použite Úplné storno a vytvorte novú faktúru so správnou sadzbou'}</span>
                  </div>
                )}
              </div>
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
                  <p className="text-xs text-muted-foreground">Pôvodne: {it.quantity} {unitLabel(it.unit)}</p>
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



      {/* Discount UI */}
      {selected === 'discount' && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-3">Nastavte zľavu</h3>

          {/* Uniform discount */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Rovnaká zľava na všetky položky</p>
              <p className="text-xs text-muted-foreground">Aplikuje rovnaké % na každú položku</p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={uniformDiscount}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setUniformDiscount(val)
                  setDiscountPercents(Object.fromEntries(original.items.map((_it, i) => [i, val])))
                }}
                className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Per-line discounts */}
          <p className="text-xs text-muted-foreground mb-2">Alebo nastavte zľavu jednotlivo:</p>
          <div className="space-y-2">
            {original.items.map((it, idx) => {
              const pct = discountPercents[idx] ?? 0
              const discountAmt = r2(it.line_total * pct / 100)
              return (
                <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${pct > 0 ? 'bg-pink-500/10 border border-pink-500/20' : 'bg-secondary/30'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{it.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.quantity} {unitLabel(it.unit)} x {it.unit_price.toFixed(2)} EUR = {it.line_total.toFixed(2)} EUR
                    </p>
                    {pct > 0 && (
                      <p className="text-xs text-pink-400 mt-0.5">Zľava: {discountAmt.toFixed(2)} EUR</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={pct}
                      onChange={(e) => setDiscountPercents(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                      className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total summary */}
          {Object.values(discountPercents).some(p => p > 0) && (
            <div className="mt-3 p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <p className="text-xs font-medium text-pink-400">Celková zľava (dobropis):</p>
              <p className="text-sm font-bold text-foreground mt-1">
                {original.items
                  .reduce((sum, it, idx) => sum + r2(it.line_total * (discountPercents[idx] ?? 0) / 100), 0)
                  .toFixed(2)} EUR
              </p>
            </div>
          )}
        </GlassCard>
      )}

      {/* Freeform: editable item descriptions */}
      {selected === 'freeform' && original.items.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-1">Položky</h3>
          <p className="text-xs text-muted-foreground mb-3">Upravte názvy položiek ak sú nesprávne.</p>
          <div className="space-y-2">
            {original.items.map((it, idx) => {
              const currentDesc = itemDescOverrides[idx] ?? it.description
              const isChanged = currentDesc !== it.description
              return (
                <div key={idx} className={`p-2.5 rounded-lg transition-colors ${isChanged ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-secondary/30'}`}>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Položka {idx + 1}
                    {isChanged && <span className="text-violet-400 ml-1">(zmenené)</span>}
                  </label>
                  <input
                    type="text"
                    value={currentDesc}
                    onChange={(e) => setItemDescOverrides(prev => ({ ...prev, [idx]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                  />
                  {isChanged && (
                    <p className="text-xs text-muted-foreground mt-1">Pôvodne: {it.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{it.quantity} {unitLabel(it.unit)} x {it.unit_price.toFixed(2)} EUR ({it.vat_rate}% DPH)</p>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* Freeform: editable non-financial fields */}
      {selected === 'freeform' && (
        <GlassCard>
          <h3 className="text-sm font-medium text-foreground mb-1">Ostatné údaje</h3>
          <p className="text-xs text-muted-foreground mb-4">Zmeňte údaje, ktoré chcete opraviť. Dôvod opravy sa vyplní automaticky.</p>
          <div className="space-y-3">
            {(Object.keys(FIELD_LABELS) as (keyof EditableFields)[]).map((key) => {
              const origVal = (original[key] as string) || ''
              const currentVal = freeformFields[key] || ''
              const isChanged = origVal !== currentVal
              return (
                <div key={key} className={`p-2.5 rounded-lg transition-colors ${isChanged ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-secondary/30'}`}>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {FIELD_LABELS[key]}
                    {isChanged && <span className="text-violet-400 ml-1">(zmenené)</span>}
                  </label>
                  {key === 'note' ? (
                    <textarea
                      value={currentVal}
                      onChange={(e) => setFreeformFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm resize-none"
                      rows={2}
                    />
                  ) : key === 'delivery_date' ? (
                    <input
                      type="date"
                      value={currentVal}
                      onChange={(e) => setFreeformFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => setFreeformFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                    />
                  )}
                  {isChanged && origVal && (
                    <p className="text-xs text-muted-foreground mt-1">Pôvodne: {origVal}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Change summary */}
          {freeformChanges.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs font-medium text-violet-400 mb-1">Zhrnutie zmien ({freeformChanges.length})</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {freeformChanges.map((c, i) => (
                  <li key={i}>
                    <span className="text-foreground">{c.label}</span>: {c.from || '(prázdne)'} &rarr; <span className="text-violet-400">{c.to || '(prázdne)'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>
      )}

      {/* Validation errors from direct creation */}
      {creationErrors && creationErrors.length > 0 && (
        <GlassCard className="border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive mb-2">Validácia zlyhala</p>
              <ul className="text-xs text-destructive/80 space-y-1">
                {creationErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {creationErrors.length > 5 && (
                  <li className="text-muted-foreground">...a {creationErrors.length - 5} ďalších chýb</li>
                )}
              </ul>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Apply button */}
      {selected && (
        <button
          onClick={handleApply}
          disabled={isCreating}
          className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Vytvára sa dobropis...
            </>
          ) : selected === 'full_storno' && onDirectCreate ? (
            <>
              Vytvoriť dobropis
              <ChevronRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Pripraviť korekciu
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
