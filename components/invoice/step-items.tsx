'use client'

import { GlassCard } from '@/components/glass-card'
import { Package, Plus, Trash2 } from 'lucide-react'
import type { InvoiceFormData, InvoiceItem } from '@/lib/schemas'

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
  totals: { withoutVat: number; vat: number; withVat: number }
}

const unitOptions = [
  { value: 'C62', label: 'ks (kus)' },
  { value: 'HUR', label: 'hod (hodina)' },
  { value: 'DAY', label: 'den' },
  { value: 'MON', label: 'mesiac' },
  { value: 'KGM', label: 'kg' },
  { value: 'MTR', label: 'm' },
  { value: 'LTR', label: 'l' },
  { value: 'MTK', label: 'm2' },
]

const vatRates = [
  { value: 20, label: '20% (zakladna)' },
  { value: 10, label: '10% (znizena)' },
  { value: 5, label: '5% (znizena)' },
  { value: 0, label: '0% (oslobodene)' },
]

export function StepItems({ formData, updateForm, totals }: Props) {
  function addItem() {
    const newItem: InvoiceItem = {
      line_number: formData.items.length + 1,
      description: '',
      quantity: 1,
      unit: 'C62',
      unit_price: 0,
      vat_category: 'S',
      vat_rate: 20,
      line_total: 0,
      item_number: null,
      buyer_item_number: null,
    }
    updateForm({ items: [...formData.items, newItem] })
  }

  function removeItem(index: number) {
    if (formData.items.length <= 1) return
    const items = formData.items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, line_number: i + 1 }))
    updateForm({ items })
  }

  function updateItem(index: number, updates: Partial<InvoiceItem>) {
    const items = formData.items.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, ...updates }
      updated.line_total = updated.quantity * updated.unit_price
      if (updates.vat_rate === 0) updated.vat_category = 'Z'
      else if (updates.vat_rate !== undefined && updates.vat_rate > 0) updated.vat_category = 'S'
      return updated
    })
    updateForm({ items })
  }

  const fmt = (n: number) =>
    n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Polozky faktury</h2>
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Pridat polozku
          </button>
        </div>

        <div className="space-y-4">
          {formData.items.map((item, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Polozka {i + 1}
                </span>
                {formData.items.length > 1 && (
                  <button
                    onClick={() => removeItem(i)}
                    className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Popis *</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                  placeholder="Popis polozky"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Mnozstvo</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                    min="0"
                    step="0.001"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Jednotka</label>
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(i, { unit: e.target.value })}
                    className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                  >
                    {unitOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Cena/j. bez DPH</label>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                    className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">DPH</label>
                  <select
                    value={item.vat_rate}
                    onChange={(e) => updateItem(i, { vat_rate: parseFloat(e.target.value) })}
                    className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                  >
                    {vatRates.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <span className="text-muted-foreground">Spolu: </span>
                <span className="text-foreground font-medium ml-2">
                  {fmt(item.quantity * item.unit_price)} {formData.currency}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Totals */}
      <GlassCard heavy>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zaklad dane:</span>
            <span className="text-foreground">{fmt(totals.withoutVat)} {formData.currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">DPH celkom:</span>
            <span className="text-foreground">{fmt(totals.vat)} {formData.currency}</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Celkom na uhradu:</span>
            <span className="text-xl font-bold text-primary">
              {fmt(totals.withVat)} {formData.currency}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
