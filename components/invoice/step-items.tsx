'use client'

import { useRef, useState, useCallback } from 'react'
import { GlassCard } from '@/components/glass-card'
import { Copy, Package, Plus, Trash2, Info, Paperclip, Upload, X, FileText, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react'
import type { InvoiceFormData, InvoiceItem, InvoiceAttachment } from '@/lib/schemas'
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE } from '@/lib/schemas'
import {
  ALLOWANCE_REASON_CODES,
  CHARGE_REASON_CODES,
  DEFAULT_ALLOWANCE_REASON_CODE,
  DEFAULT_CHARGE_REASON_CODE,
} from '@/lib/constants'
import { toast } from 'sonner'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
  totals: { withoutVat: number; vat: number; withVat: number }
  isVatPayer?: boolean
  invoiceMode?: string
  isCorrectionMode?: boolean
  validationErrors?: Set<string>
  shakeFields?: boolean
}

function fieldClass(fieldId: string, validationErrors?: Set<string>, shakeFields?: boolean) {
  const hasError = validationErrors?.has(fieldId)
  return hasError 
    ? `validation-error ${shakeFields ? 'animate-shake' : ''}` 
    : ''
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
  { value: 23, label: '23% (základná od 2025)' },
  { value: 19, label: '19% (znížená od 2025)' },
  { value: 10, label: '10% (znížená)' },
  { value: 5, label: '5% (znížená)' },
  { value: 0, label: '0% (oslobodené)' },
]

const ACCEPT_TYPES = ALLOWED_MIME_TYPES.join(',')

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type AdjustmentMode = 'percent' | 'amount'

function deriveLineAllowanceMode(item: InvoiceItem): AdjustmentMode {
  if ((item.discount_amount || 0) > 0) return 'amount'
  if ((item.discount_percent || 0) > 0) return 'percent'
  return 'percent'
}

function deriveLineChargeMode(item: InvoiceItem): AdjustmentMode {
  if ((item.charge_amount || 0) > 0) return 'amount'
  if ((item.charge_percent || 0) > 0) return 'percent'
  return 'percent'
}

function deriveGlobalDiscountMode(form: InvoiceFormData): AdjustmentMode {
  if ((form.global_discount_amount || 0) > 0) return 'amount'
  if ((form.global_discount_percent || 0) > 0) return 'percent'
  return 'percent'
}

function deriveGlobalChargeMode(form: InvoiceFormData): AdjustmentMode {
  if ((form.global_charge_amount || 0) > 0) return 'amount'
  if ((form.global_charge_percent || 0) > 0) return 'percent'
  return 'percent'
}

export function StepItems({ formData, updateForm, totals, isVatPayer = true, invoiceMode = 'standard', isCorrectionMode = false, validationErrors, shakeFields }: Props) {
  const isReverseCharge = invoiceMode === 'reversecharge'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const existing = formData.attachments || []

    for (const file of fileArray) {
      if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
        toast.error(`${file.name}: nepodporovaný formát. Povolené: PDF, PNG, JPEG, CSV, Excel, ODS`)
        continue
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`${file.name}: súbor je príliš veľký (max ${formatFileSize(MAX_ATTACHMENT_SIZE)})`)
        continue
      }
      if (existing.some(a => a.filename.toLowerCase() === file.name.toLowerCase())) {
        toast.error(`${file.name}: súbor s rovnakým názvom už existuje`)
        continue
      }

      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const attachment: InvoiceAttachment = {
          id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          filename: file.name,
          mimeCode: file.type,
          description: '',
          data: base64,
          size: file.size,
        }
        updateForm({ attachments: [...(formData.attachments || []), attachment] })
      }
      reader.readAsDataURL(file)
    }
  }, [formData.attachments, updateForm])

  function removeAttachment(id: string) {
    updateForm({ attachments: (formData.attachments || []).filter(a => a.id !== id) })
  }

  function updateAttachmentDescription(id: string, description: string) {
    updateForm({
      attachments: (formData.attachments || []).map(a =>
        a.id === id ? { ...a, description } : a
      ),
    })
  }

  function addItem() {
    const newItem: InvoiceItem = {
      line_number: formData.items.length + 1,
      description: '',
      quantity: 1,
      unit: 'C62',
      unit_price: 0,
      vat_category: isReverseCharge ? 'AE' : isVatPayer ? 'S' : 'O',
      vat_rate: isReverseCharge ? 0 : isVatPayer ? 23 : 0,
      discount_percent: 0,
      discount_amount: 0,
      allowance_reason_code: null,
      charge_percent: 0,
      charge_amount: 0,
      charge_reason_code: null,
      base_quantity: 1,
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

  function duplicateItem(index: number) {
    const source = formData.items[index]
    const copy: InvoiceItem = { ...source, line_number: formData.items.length + 1 }
    const items = [...formData.items, copy]
    updateForm({ items })
  }

  function recomputeLineTotal(item: InvoiceItem): number {
    const baseQty = item.base_quantity && item.base_quantity > 0 ? item.base_quantity : 1
    const pricePart = round2((item.unit_price / baseQty) * item.quantity)
    const allowance = (item.discount_amount || 0) > 0
      ? round2(item.discount_amount)
      : round2(pricePart * (item.discount_percent || 0) / 100)
    const charge = (item.charge_amount || 0) > 0
      ? round2(item.charge_amount)
      : round2(pricePart * (item.charge_percent || 0) / 100)
    return round2(pricePart + charge - allowance)
  }

  function updateItem(index: number, updates: Partial<InvoiceItem>) {
    const items = formData.items.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, ...updates }
      if (updates.discount_percent !== undefined && updates.discount_percent > 0) {
        updated.discount_amount = 0
      }
      if (updates.discount_amount !== undefined && updates.discount_amount > 0) {
        updated.discount_percent = 0
      }
      if (updates.charge_percent !== undefined && updates.charge_percent > 0) {
        updated.charge_amount = 0
      }
      if (updates.charge_amount !== undefined && updates.charge_amount > 0) {
        updated.charge_percent = 0
      }
      updated.line_total = recomputeLineTotal(updated)
      if (isReverseCharge) {
        updated.vat_category = 'AE'
        updated.vat_rate = 0
      } else if (updates.vat_rate === 0) updated.vat_category = 'E'
      else if (updates.vat_rate !== undefined && updates.vat_rate > 0) updated.vat_category = 'S'
      return updated
    })
    updateForm({ items })
  }

  function setLineAllowanceMode(index: number, mode: AdjustmentMode) {
    updateItem(index, mode === 'percent' ? { discount_amount: 0 } : { discount_percent: 0 })
  }

  function setLineChargeMode(index: number, mode: AdjustmentMode) {
    updateItem(index, mode === 'percent' ? { charge_amount: 0 } : { charge_percent: 0 })
  }

  function setGlobalDiscountMode(mode: AdjustmentMode) {
    updateForm(mode === 'percent' ? { global_discount_amount: 0 } : { global_discount_percent: 0 })
  }

  function setGlobalChargeMode(mode: AdjustmentMode) {
    updateForm(mode === 'percent' ? { global_charge_amount: 0 } : { global_charge_percent: 0 })
  }

  const fmt = (n: number) =>
    n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      {isReverseCharge && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Vsetky polozky maju prenesenu dan. povinnost (DPH = 0%)</p>
            <p className="text-muted-foreground mt-0.5">
              Podla EN16931 (BR-AE-05) nie je mozne kombinovat standardnu a prenesenu DPH na jednej fakture. Ak potrebujete polozky so standardnou DPH, vytvorte pre ne samostatnu fakturu.
            </p>
          </div>
        </div>
      )}
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Položky faktúry</h2>
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Pridať položku
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
                  Položka {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateItem(i)}
                    className="p-1.5 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors"
                    title="Duplikovať položku"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {formData.items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                      title="Odstrániť položku"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Popis *</label>
                <input
                  id={`item_desc_${i}`}
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  className={`glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm ${!item.description || validationErrors?.has(`item_desc_${i}`) ? `ring-1 ring-destructive/50 ${shakeFields && validationErrors?.has(`item_desc_${i}`) ? 'animate-shake' : ''}` : ''}`}
                  placeholder="Popis položky"
                />
              </div>

              <div className={`grid grid-cols-2 ${isVatPayer ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Množstvo *</label>
                  <input
                    id={`item_qty_${i}`}
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    className={`glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm ${!item.quantity || validationErrors?.has(`item_qty_${i}`) ? `ring-1 ring-destructive/50 ${shakeFields && validationErrors?.has(`item_qty_${i}`) ? 'animate-shake' : ''}` : ''}`}
                    {...(!isCorrectionMode && { min: '0' })}
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
                  <label className="block text-xs text-muted-foreground mb-1">{isVatPayer ? 'Cena/j. bez DPH *' : 'Cena/j. *'}</label>
                  <input
                    id={`item_price_${i}`}
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    className={`glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm ${!item.unit_price || validationErrors?.has(`item_price_${i}`) ? `ring-1 ring-destructive/50 ${shakeFields && validationErrors?.has(`item_price_${i}`) ? 'animate-shake' : ''}` : ''}`}
                    {...(!isCorrectionMode && { min: '0' })}
                    step="0.01"
                  />
                </div>
                {isVatPayer && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">DPH</label>
                    {isReverseCharge ? (
                      <div className="glass-input w-full px-3 py-2 rounded-lg text-muted-foreground text-sm bg-muted/30 cursor-not-allowed">
                        0% (AE)
                      </div>
                    ) : (
                      <select
                        value={item.vat_rate}
                        onChange={(e) => updateItem(i, { vat_rate: parseFloat(e.target.value) })}
                        className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                      >
                        {vatRates.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Zľava</label>
                  <AdjustmentInput
                    mode={deriveLineAllowanceMode(item)}
                    percentValue={item.discount_percent || 0}
                    amountValue={item.discount_amount || 0}
                    currency={formData.currency}
                    onModeChange={(m) => setLineAllowanceMode(i, m)}
                    onPercentChange={(v) => updateItem(i, { discount_percent: v })}
                    onAmountChange={(v) => updateItem(i, { discount_amount: v })}
                  />
                </div>
              </div>

              {expanded.has(i) && (
                <div className="rounded-lg bg-background/40 border border-border/50 p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Dôvod zľavy</label>
                      <select
                        value={item.allowance_reason_code || DEFAULT_ALLOWANCE_REASON_CODE}
                        onChange={(e) => updateItem(i, { allowance_reason_code: e.target.value })}
                        className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                      >
                        {ALLOWANCE_REASON_CODES.map((r) => (
                          <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Prirážka (na položku)</label>
                      <AdjustmentInput
                        mode={deriveLineChargeMode(item)}
                        percentValue={item.charge_percent || 0}
                        amountValue={item.charge_amount || 0}
                        currency={formData.currency}
                        onModeChange={(m) => setLineChargeMode(i, m)}
                        onPercentChange={(v) => updateItem(i, { charge_percent: v })}
                        onAmountChange={(v) => updateItem(i, { charge_amount: v })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Dôvod prirážky</label>
                      <select
                        value={item.charge_reason_code || DEFAULT_CHARGE_REASON_CODE}
                        onChange={(e) => updateItem(i, { charge_reason_code: e.target.value })}
                        className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                      >
                        {CHARGE_REASON_CODES.map((r) => (
                          <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Základné množstvo
                        <span className="text-muted-foreground/70"> (cena platí za N {unitOptions.find(u => u.value === item.unit)?.label.split(' ')[0] || 'j'})</span>
                      </label>
                      <input
                        type="number"
                        value={item.base_quantity || 1}
                        onChange={(e) => updateItem(i, { base_quantity: parseFloat(e.target.value) || 1 })}
                        className="glass-input w-full px-3 py-2 rounded-lg text-foreground text-sm"
                        min="0.001"
                        step="0.001"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => toggleExpanded(i)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {expanded.has(i)
                    ? <><ChevronUp className="w-3 h-3" />Menej</>
                    : <><ChevronDown className="w-3 h-3" />Prirážka / Pokročilé</>}
                </button>
                <div className="flex items-center gap-3">
                  {((item.discount_percent || 0) > 0 || (item.discount_amount || 0) > 0) && (
                    <span className="text-muted-foreground line-through text-xs">
                      {fmt(item.quantity * item.unit_price / (item.base_quantity || 1))}
                    </span>
                  )}
                  <span className="text-muted-foreground">Spolu: </span>
                  <span className="text-foreground font-medium">
                    {fmt(item.line_total || item.quantity * item.unit_price)} {formData.currency}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Attachments (BG-24) */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Paperclip className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Prílohy</h2>
          <span className="text-xs text-muted-foreground">(voliteľné)</span>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            processFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary bg-primary/10'
              : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
          }`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-sm text-foreground font-medium">
            Pretiahnite súbory sem alebo kliknite pre výber
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, PNG, JPEG, CSV, Excel, ODS &middot; max {formatFileSize(MAX_ATTACHMENT_SIZE)} / súbor
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_TYPES}
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
        </div>

        {/* Attachment list */}
        {(formData.attachments || []).length > 0 && (
          <div className="mt-3 space-y-2">
            {(formData.attachments || []).map((att) => (
              <div key={att.id} className="flex items-start gap-3 glass-card rounded-xl p-3">
                <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{att.filename}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                      {MIME_LABELS[att.mimeCode] || att.mimeCode}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatFileSize(att.size)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={att.description}
                    onChange={(e) => updateAttachmentDescription(att.id, e.target.value)}
                    className="glass-input w-full px-2 py-1 rounded-lg text-foreground text-xs"
                    placeholder="Popis prílohy (voliteľný)"
                  />
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Odstrániť prílohu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Document-level allowance (BG-20) and charge (BG-21) */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Zľavy a prirážky na faktúru</h2>
          </div>

          {/* Document allowance */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zľava na faktúru</label>
              <AdjustmentInput
                mode={deriveGlobalDiscountMode(formData)}
                percentValue={formData.global_discount_percent || 0}
                amountValue={formData.global_discount_amount || 0}
                currency={formData.currency}
                onModeChange={setGlobalDiscountMode}
                onPercentChange={(v) => updateForm({ global_discount_percent: v })}
                onAmountChange={(v) => updateForm({ global_discount_amount: v })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dôvod</label>
              <select
                value={formData.global_discount_reason_code || DEFAULT_ALLOWANCE_REASON_CODE}
                onChange={(e) => updateForm({ global_discount_reason_code: e.target.value })}
                className="glass-input w-48 px-3 py-2 rounded-lg text-foreground text-sm"
              >
                {ALLOWANCE_REASON_CODES.map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
                ))}
              </select>
            </div>
            {((formData.global_discount_percent || 0) > 0 || (formData.global_discount_amount || 0) > 0) && (
              <div className="text-right text-sm text-primary whitespace-nowrap pb-2">
                -{fmt(
                  (formData.global_discount_amount || 0) > 0
                    ? (formData.global_discount_amount || 0)
                    : totals.withoutVat * (formData.global_discount_percent || 0) / 100
                )} {formData.currency}
              </div>
            )}
          </div>

          {/* Document charge */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end pt-3 border-t border-border/50">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Prirážka na faktúru
              </label>
              <AdjustmentInput
                mode={deriveGlobalChargeMode(formData)}
                percentValue={formData.global_charge_percent || 0}
                amountValue={formData.global_charge_amount || 0}
                currency={formData.currency}
                onModeChange={setGlobalChargeMode}
                onPercentChange={(v) => updateForm({ global_charge_percent: v })}
                onAmountChange={(v) => updateForm({ global_charge_amount: v })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dôvod</label>
              <select
                value={formData.global_charge_reason_code || DEFAULT_CHARGE_REASON_CODE}
                onChange={(e) => updateForm({ global_charge_reason_code: e.target.value })}
                className="glass-input w-48 px-3 py-2 rounded-lg text-foreground text-sm"
              >
                {CHARGE_REASON_CODES.map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
                ))}
              </select>
            </div>
            {((formData.global_charge_percent || 0) > 0 || (formData.global_charge_amount || 0) > 0) && (
              <div className="text-right text-sm text-amber-500 whitespace-nowrap pb-2">
                +{fmt(
                  (formData.global_charge_amount || 0) > 0
                    ? (formData.global_charge_amount || 0)
                    : totals.withoutVat * (formData.global_charge_percent || 0) / 100
                )} {formData.currency}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Totals */}
      <GlassCard heavy>
        <div className="space-y-2">
          {(() => {
            const lineSum = formData.items.reduce((s, it) => {
              const bq = (it.base_quantity && it.base_quantity > 0) ? it.base_quantity : 1
              const price = round2((it.unit_price / bq) * it.quantity)
              const allow = (it.discount_amount || 0) > 0
                ? round2(it.discount_amount)
                : round2(price * (it.discount_percent || 0) / 100)
              const charge = (it.charge_amount || 0) > 0
                ? round2(it.charge_amount)
                : round2(price * (it.charge_percent || 0) / 100)
              return s + round2(price + charge - allow)
            }, 0)
            const docAllow = (formData.global_discount_amount || 0) > 0
              ? round2(formData.global_discount_amount)
              : round2(lineSum * (formData.global_discount_percent || 0) / 100)
            const docCharge = (formData.global_charge_amount || 0) > 0
              ? round2(formData.global_charge_amount)
              : round2(lineSum * (formData.global_charge_percent || 0) / 100)
            return (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Súčet položiek:</span>
                  <span className="text-foreground">{fmt(lineSum)} {formData.currency}</span>
                </div>
                {docAllow > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Zľava na faktúru:</span>
                    <span className="text-primary">-{fmt(docAllow)} {formData.currency}</span>
                  </div>
                )}
                {docCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prirážka na faktúru:</span>
                    <span className="text-amber-500">+{fmt(docCharge)} {formData.currency}</span>
                  </div>
                )}
                {(docAllow > 0 || docCharge > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Základ dane:</span>
                    <span className="text-foreground">{fmt(round2(lineSum - docAllow + docCharge))} {formData.currency}</span>
                  </div>
                )}
              </>
            )
          })()}
          {isVatPayer && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">DPH celkom:</span>
              <span className="text-foreground">{fmt(totals.vat)} {formData.currency}</span>
            </div>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Celkom na úhradu:</span>
            <span className="text-xl font-bold text-primary">
              {fmt(totals.withVat)} {formData.currency}
            </span>
          </div>
          {!isVatPayer && !isReverseCharge && (
            <p className="text-xs text-muted-foreground mt-2">Dodávateľ nie je platcom DPH</p>
          )}
          {isReverseCharge && (
            <p className="text-xs text-amber-500 mt-2">Prenesenie daňovej povinnosti -- DPH = 0% na všetkých položkách</p>
          )}
        </div>
      </GlassCard>
    </div>
  )
}

interface AdjustmentInputProps {
  mode: AdjustmentMode
  percentValue: number
  amountValue: number
  currency: string
  onModeChange: (mode: AdjustmentMode) => void
  onPercentChange: (value: number) => void
  onAmountChange: (value: number) => void
}

function AdjustmentInput({
  mode,
  percentValue,
  amountValue,
  currency,
  onModeChange,
  onPercentChange,
  onAmountChange,
}: AdjustmentInputProps) {
  return (
    <div className="flex items-stretch gap-1">
      <div className="flex rounded-lg overflow-hidden border border-border/60 bg-background/30">
        <button
          type="button"
          onClick={() => onModeChange('percent')}
          className={`px-2 text-xs font-medium transition-colors ${
            mode === 'percent'
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Percento"
        >%</button>
        <button
          type="button"
          onClick={() => onModeChange('amount')}
          className={`px-2 text-xs font-medium transition-colors border-l border-border/60 ${
            mode === 'amount'
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={currency}
        >{currency === 'EUR' ? '€' : currency}</button>
      </div>
      {mode === 'percent' ? (
        <input
          type="number"
          value={percentValue || 0}
          onChange={(e) => onPercentChange(parseFloat(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          className="glass-input flex-1 min-w-0 px-3 py-2 rounded-lg text-foreground text-sm"
          min="0"
          max="100"
          step="0.5"
        />
      ) : (
        <input
          type="number"
          value={amountValue || 0}
          onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          className="glass-input flex-1 min-w-0 px-3 py-2 rounded-lg text-foreground text-sm"
          min="0"
          step="0.01"
        />
      )}
    </div>
  )
}
