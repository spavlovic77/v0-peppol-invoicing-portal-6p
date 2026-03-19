'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Building2 } from 'lucide-react'
import { StepBasicInfo } from '@/components/invoice/step-basic-info'
import { StepBuyer } from '@/components/invoice/step-buyer'
import { StepItems } from '@/components/invoice/step-items'
import { StepSummary } from '@/components/invoice/step-summary'
import { InvoiceWizardStepper } from '@/components/invoice/wizard-stepper'
import { CorrectionWizard, type CorrectionScenario } from '@/components/invoice/correction-wizard'
import { useActiveSupplier, type Supplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import type { InvoiceFormData } from '@/lib/schemas'
import Link from 'next/link'
import { useAiPanel } from '@/lib/ai-context'

// Maps validation rule IDs to { step, field } for auto-focus on failure
function mapRuleToField(ruleId: string): { step: number; field: string } {
  const r = ruleId.toUpperCase()
  if (r.includes('STRUCT-01') || r.includes('BR-02')) return { step: 0, field: 'invoice_number' }
  if (r.includes('STRUCT-02')) return { step: 0, field: 'issue_date' }
  if (r.includes('STRUCT-03')) return { step: 0, field: 'due_date' }
  if (r.includes('BR-05')) return { step: 0, field: 'currency' }
  if (r.includes('BR-61') || r.includes('BANK-R001') || r.includes('R041')) return { step: 0, field: 'iban' }
  if (r.includes('PEPPOL') && r.includes('R003')) return { step: 0, field: 'buyer_reference' }
  if (r.includes('PEPPOL') && r.includes('R007')) return { step: 0, field: 'buyer_reference' }
  if (r.includes('STRUCT-07') || r.includes('BR-07')) return { step: 1, field: 'buyer_name' }
  if (r.includes('STRUCT-10')) return { step: 1, field: 'buyer_dic' }
  if (r.includes('STRUCT-12') || r.includes('BR-09')) return { step: 1, field: 'buyer_country_code' }
  if (r.includes('STRUCT-08') || r.includes('BR-21') || r.includes('BR-23')) return { step: 2, field: 'item_desc_0' }
  if (r.includes('BR-22')) return { step: 2, field: 'item_qty_0' }
  if (r.includes('BR-24') || r.includes('BR-25')) return { step: 2, field: 'item_price_0' }
  return { step: 0, field: 'invoice_number' }
}

function makeDefaultItem(mode: string) {
  return {
    line_number: 1,
    description: '',
    quantity: 1,
    unit: 'C62',
    unit_price: 0,
    vat_category: mode === 'reversecharge' ? 'AE' : 'S',
    vat_rate: mode === 'reversecharge' ? 0 : 23,
    discount_percent: 0,
    discount_amount: 0,
    line_total: 0,
    item_number: null,
    buyer_item_number: null,
  }
}

export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { activeSupplier, loading: supplierLoading } = useActiveSupplier()
  const { setPageContext } = useAiPanel()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const duplicateId = searchParams.get('duplicate')
  const editId = searchParams.get('edit')
  const correctId = searchParams.get('correct')
  const modeParam = searchParams.get('mode') as 'standard' | 'selfbilling' | 'reversecharge' | null
  const invoiceMode = modeParam || 'standard'
  const isSelfBilling = invoiceMode === 'selfbilling'
  const isReverseCharge = invoiceMode === 'reversecharge'
  const isEditMode = !!editId
  const isCorrectionMode = !!correctId
  const [correctionStep, setCorrectionStep] = useState<'wizard' | 'form'>(correctId ? 'wizard' : 'form')
  const [directCreating, setDirectCreating] = useState(false)
  const [directCreationErrors, setDirectCreationErrors] = useState<string[]>([])

  const [originalInvoice, setOriginalInvoice] = useState<{
    id: string; invoice_number: string; issue_date: string; buyer_name: string;
    buyer_ico: string; buyer_dic: string; buyer_ic_dph: string;
    buyer_street: string; buyer_city: string; buyer_postal_code: string; buyer_country_code: string;
    buyer_email: string; buyer_peppol_id: string; buyer_reference: string; order_reference: string;
    delivery_date: string; note: string; payment_means_code: string;
    items: { description: string; quantity: number; unit: string; unit_price: number; vat_rate: number; vat_category: string; item_number: string | null; buyer_item_number: string | null; discount_percent: number; discount_amount: number; line_total: number }[]
  } | null>(null)

  const [formData, setFormData] = useState<InvoiceFormData>({
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    buyer_ico: null,
    buyer_dic: null,
    buyer_ic_dph: null,
    buyer_name: '',
    buyer_street: null,
    buyer_city: null,
    buyer_postal_code: null,
    buyer_country_code: 'SK',
    buyer_email: null,
    buyer_peppol_id: null,
    order_reference: null,
    buyer_reference: null,
    payment_means_code: '30',
    bank_name: null,
    iban: null,
    swift: null,
    variable_symbol: null,
    note: isReverseCharge ? 'Prenesenie daňovej povinnosti' : null,
    global_discount_percent: 0,
    global_discount_amount: 0,
    invoice_mode: invoiceMode,
    invoice_type_code: isSelfBilling ? '389' : '380',
    items: [makeDefaultItem(invoiceMode)],
  })

  // Feed AI assistant with wizard context
  useEffect(() => {
    const stepNames = ['zakladne-udaje', 'odberatel', 'polozky', 'sumar']
    setPageContext({
      page: 'invoice-wizard',
      step: stepNames[step] || step,
      invoice_mode: invoiceMode,
      invoice_number: formData.invoice_number,
      buyer_name: formData.buyer_name,
      items_count: formData.items?.length || 0,
      is_correction: isCorrectionMode,
    })
  }, [step, invoiceMode, formData.invoice_number, formData.buyer_name, formData.items?.length, isCorrectionMode, setPageContext])

  const loadData = useCallback(async () => {
    if (!activeSupplier) { setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Pre-fill payment from active supplier
    setFormData((prev) => ({
      ...prev,
      bank_name: activeSupplier.bank_name,
      iban: activeSupplier.iban,
      swift: activeSupplier.swift,
    }))

    // If editing, load the full invoice including number and dates
    if (editId) {
      const { data: srcInv } = await supabase.from('invoices').select('*').eq('id', editId).eq('user_id', user.id).single()
      const { data: srcItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', editId).order('line_number')
      if (srcInv) {
        setFormData((prev) => ({
          ...prev,
          invoice_number: srcInv.invoice_number,
          issue_date: srcInv.issue_date,
          due_date: srcInv.due_date,
          delivery_date: srcInv.delivery_date || prev.delivery_date,
          currency: srcInv.currency || 'EUR',
          buyer_ico: srcInv.buyer_ico,
          buyer_dic: srcInv.buyer_dic,
          buyer_ic_dph: srcInv.buyer_ic_dph,
          buyer_name: srcInv.buyer_name,
          buyer_street: srcInv.buyer_street,
          buyer_city: srcInv.buyer_city,
          buyer_postal_code: srcInv.buyer_postal_code,
          buyer_country_code: srcInv.buyer_country_code || 'SK',
          buyer_email: srcInv.buyer_email,
          buyer_peppol_id: srcInv.buyer_peppol_id,
          order_reference: srcInv.order_reference,
          buyer_reference: srcInv.buyer_reference,
          payment_means_code: srcInv.payment_means_code || '30',
          bank_name: srcInv.bank_name || prev.bank_name,
          iban: srcInv.iban || prev.iban,
          swift: srcInv.swift || prev.swift,
          variable_symbol: srcInv.variable_symbol,
          note: srcInv.note,
          global_discount_percent: srcInv.global_discount_percent || 0,
          global_discount_amount: srcInv.global_discount_amount || 0,
          items: srcItems?.length ? srcItems.map((it: Record<string, unknown>, idx: number) => {
            const qty = it.quantity as number
            const price = it.unit_price as number
            const dp = (it.discount_percent as number) || 0
            const da = (it.discount_amount as number) || 0
            return {
              line_number: idx + 1,
              description: it.description as string,
              quantity: qty,
              unit: (it.unit as string) || 'C62',
              unit_price: price,
              vat_category: (it.vat_category as string) || 'S',
              vat_rate: (it.vat_rate as number) || 23,
              discount_percent: dp,
              discount_amount: da,
              line_total: Math.round((qty * price - da) * 100) / 100,
              item_number: (it.item_number as string) || null,
              buyer_item_number: (it.buyer_item_number as string) || null,
            }
          }) : [makeDefaultItem(invoiceMode)],
        }))
        setLoading(false)
        return // Skip invoice number generation
      }
    }

    // If duplicating, load the source invoice
    if (duplicateId) {
      const { data: srcInv } = await supabase.from('invoices').select('*').eq('id', duplicateId).eq('user_id', user.id).single()
      const { data: srcItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', duplicateId).order('line_number')
      if (srcInv) {
        setFormData((prev) => ({
          ...prev,
          // keep new dates & number, copy buyer + items + payment
          buyer_ico: srcInv.buyer_ico,
          buyer_dic: srcInv.buyer_dic,
          buyer_ic_dph: srcInv.buyer_ic_dph,
          buyer_name: srcInv.buyer_name,
          buyer_street: srcInv.buyer_street,
          buyer_city: srcInv.buyer_city,
          buyer_postal_code: srcInv.buyer_postal_code,
          buyer_country_code: srcInv.buyer_country_code || 'SK',
          buyer_email: srcInv.buyer_email,
          buyer_peppol_id: srcInv.buyer_peppol_id,
          order_reference: srcInv.order_reference,
          buyer_reference: srcInv.buyer_reference,
          note: srcInv.note,
          global_discount_percent: srcInv.global_discount_percent || 0,
          global_discount_amount: srcInv.global_discount_amount || 0,
          items: srcItems?.length ? srcItems.map((it: Record<string, unknown>, idx: number) => {
            const qty = it.quantity as number
            const price = it.unit_price as number
            const da = (it.discount_amount as number) || 0
            return {
              line_number: idx + 1,
              description: it.description as string,
              quantity: qty,
              unit: (it.unit as string) || 'C62',
              unit_price: price,
              vat_category: (it.vat_category as string) || 'S',
              vat_rate: (it.vat_rate as number) || 23,
              discount_percent: (it.discount_percent as number) || 0,
              discount_amount: da,
              line_total: Math.round((qty * price - da) * 100) / 100,
              item_number: (it.item_number as string) || null,
              buyer_item_number: (it.buyer_item_number as string) || null,
            }
          }) : [makeDefaultItem(invoiceMode)],
        }))
        toast.success('Udaje z povodnej faktury boli nacitane')
      }
    }

    // If correcting, load original invoice for wizard
    if (correctId) {
      const { data: srcInv } = await supabase.from('invoices').select('*').eq('id', correctId).eq('user_id', user.id).single()
      const { data: srcItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', correctId).order('line_number')
      if (srcInv && srcItems) {
        setOriginalInvoice({
          id: srcInv.id,
          invoice_number: srcInv.invoice_number,
          issue_date: srcInv.issue_date,
          buyer_name: srcInv.buyer_name || '',
          buyer_ico: srcInv.buyer_ico || '',
          buyer_dic: srcInv.buyer_dic || '',
          buyer_ic_dph: srcInv.buyer_ic_dph || '',
          buyer_street: srcInv.buyer_street || '',
          buyer_city: srcInv.buyer_city || '',
          buyer_postal_code: srcInv.buyer_postal_code || '',
          buyer_country_code: srcInv.buyer_country_code || 'SK',
          buyer_email: srcInv.buyer_email || '',
          buyer_peppol_id: srcInv.buyer_peppol_id || '',
          buyer_reference: srcInv.buyer_reference || '',
          order_reference: srcInv.order_reference || '',
          delivery_date: srcInv.delivery_date || '',
          note: srcInv.note || '',
          payment_means_code: srcInv.payment_means_code || '30',
          items: srcItems.map((it: Record<string, unknown>) => ({
            description: it.description as string,
            quantity: it.quantity as number,
            unit: (it.unit as string) || 'C62',
            unit_price: it.unit_price as number,
            vat_rate: (it.vat_rate as number) || 23,
            vat_category: (it.vat_category as string) || 'S',
            item_number: (it.item_number as string) || null,
            buyer_item_number: (it.buyer_item_number as string) || null,
            discount_percent: (it.discount_percent as number) || 0,
            discount_amount: (it.discount_amount as number) || 0,
            line_total: it.line_total as number,
          })),
        })
        // Pre-fill buyer + payment data from original
        setFormData((prev) => ({
          ...prev,
          buyer_ico: srcInv.buyer_ico,
          buyer_dic: srcInv.buyer_dic,
          buyer_ic_dph: srcInv.buyer_ic_dph,
          buyer_name: srcInv.buyer_name,
          buyer_street: srcInv.buyer_street,
          buyer_city: srcInv.buyer_city,
          buyer_postal_code: srcInv.buyer_postal_code,
          buyer_country_code: srcInv.buyer_country_code || 'SK',
          buyer_email: srcInv.buyer_email,
          buyer_peppol_id: srcInv.buyer_peppol_id,
          order_reference: srcInv.order_reference,
          buyer_reference: srcInv.buyer_reference,
          // Carry over payment/bank details from the original invoice
          iban: srcInv.iban || prev.iban,
          bank_name: srcInv.bank_name || prev.bank_name,
          swift: srcInv.swift || prev.swift,
          payment_means_code: srcInv.payment_means_code || prev.payment_means_code,
          variable_symbol: srcInv.variable_symbol || prev.variable_symbol,
        }))
      }
    }

    // Generate invoice number scoped to supplier + prefix
    const year = new Date().getFullYear()
    const prefix = correctId ? 'CN' : 'FV'
    const { data: seq } = await supabase
      .from('invoice_sequences')
      .select('*')
      .eq('user_id', user.id)
      .eq('supplier_id', activeSupplier.id)
      .eq('year', year)
      .eq('prefix', prefix)
      .maybeSingle()

    let nextNum = 1
    if (seq) {
      nextNum = (seq.last_number || 0) + 1
    }
    const invoiceNumber = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`
    setFormData((prev) => ({
      ...prev,
      invoice_number: invoiceNumber,
      variable_symbol: invoiceNumber.replace(/\D/g, '').slice(-10),
    }))

    setLoading(false)
  }, [supabase, router, activeSupplier, duplicateId, editId, correctId])

  useEffect(() => {
    if (!supplierLoading) loadData()
  }, [loadData, supplierLoading])

  // Reset step to 0 when starting a fresh new invoice (not edit/duplicate/correct)
  useEffect(() => {
    if (!editId && !duplicateId && !correctId) {
      setStep(0)
    }
  }, [editId, duplicateId, correctId])

  // Auto-focus on the field that caused a validation failure (when redirected back from handleCreate)
  useEffect(() => {
    const focusStepParam = searchParams.get('focusStep')
    const focusFieldParam = searchParams.get('focusField')
    if (focusStepParam !== null) {
      const targetStep = parseInt(focusStepParam)
      if (!isNaN(targetStep) && targetStep >= 0 && targetStep <= 3) {
        setStep(targetStep)
        // Delay focus to allow the step to render
        if (focusFieldParam) {
          setTimeout(() => {
            const el = document.getElementById(focusFieldParam)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.focus()
              // Flash a red ring briefly to draw attention
              el.classList.add('ring-2', 'ring-destructive')
              setTimeout(() => el.classList.remove('ring-2', 'ring-destructive'), 3000)
            }
          }, 400)
        }
      }
    }
  }, [searchParams])

  function updateForm(updates: Partial<InvoiceFormData>) {
    setFormData((prev) => {
      const next = { ...prev, ...updates }
      // Reverse charge: force all items to AE/0%
      if (invoiceMode === 'reversecharge' && next.items) {
        next.items = next.items.map((item) => ({
          ...item,
          vat_category: 'AE',
          vat_rate: 0,
        }))
      }
      return next
    })
  }

  const isVatPayer = activeSupplier?.is_vat_payer ?? true

  const totals = (() => {
    const r2 = (n: number) => Math.round(n * 100) / 100

    // Sum line totals (already include per-item discounts)
    const lineSum = formData.items.reduce((acc, item) => {
      const gross = item.quantity * item.unit_price
      const discount = item.discount_amount || (gross * (item.discount_percent || 0) / 100)
      return acc + (gross - discount)
    }, 0)

    // Apply global discount
    const globalDiscount = lineSum * (formData.global_discount_percent || 0) / 100

    // Non-VAT payer: no tax at all
    if (!isVatPayer) {
      const total = r2(lineSum - globalDiscount)
      return { withoutVat: total, vat: 0, withVat: total }
    }

    // Slovak reverse method: calculate VAT per tax rate group
    // Group items by tax rate
    const taxGroups = new Map<number, number>()
    for (const item of formData.items) {
      const gross = item.quantity * item.unit_price
      const itemDiscount = item.discount_amount || (gross * (item.discount_percent || 0) / 100)
      const lineNet = gross - itemDiscount
      const lineGlobalDiscount = lineSum > 0 ? (lineNet / lineSum) * globalDiscount : 0
      const groupTaxBase = r2(lineNet - lineGlobalDiscount)
      const rate = item.vat_rate || 0
      taxGroups.set(rate, (taxGroups.get(rate) || 0) + groupTaxBase)
    }

    // SK reverse calculation per group
    let totalVat = 0
    let totalTaxBase = 0
    for (const [rate, taxBase] of taxGroups) {
      if (rate === 0) {
        totalTaxBase += r2(taxBase)
        continue
      }
      const grossWithVat = r2(taxBase * (100 + rate) / 100)
      const tax_SK = r2(grossWithVat * rate / (100 + rate))
      const base_SK = r2(grossWithVat - tax_SK)
      totalVat += tax_SK
      totalTaxBase += base_SK
    }

    totalVat = r2(totalVat)
    totalTaxBase = r2(totalTaxBase)
    const withVat = r2(totalTaxBase + totalVat)

    return { withoutVat: totalTaxBase, vat: totalVat, withVat }
  })()

  async function handleCreate() {
    if (!activeSupplier) return

    // Validate mandatory fields per Slovak VAT law 222/2004 §74
    const errors: string[] = []
    if (!formData.delivery_date) errors.push('Dátum dodania je povinný')
    if (!formData.buyer_name) errors.push('Názov odberateľa je povinný')
    if (!formData.buyer_street) errors.push('Ulica odberateľa je povinná')
    if (!formData.buyer_city) errors.push('Mesto odberateľa je povinné')
    if (!formData.buyer_postal_code) errors.push('PSČ odberateľa je povinné')
    if (!formData.buyer_country_code) errors.push('Krajina odberateľa je povinná')

    // Validate items
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i]
      if (!item.description) errors.push(`Položka ${i + 1}: Popis je povinný`)
      if (!item.quantity) errors.push(`Položka ${i + 1}: Množstvo je povinné`)
      if (!item.unit_price) errors.push(`Položka ${i + 1}: Jednotková cena je povinná`)
    }

    if (errors.length > 0) {
      toast.error(`Chýbajú povinné údaje: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` a ${errors.length - 3} ďalších` : ''}`)
      return
    }

    setCreating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const invoicePayload = {
        user_id: user.id,
        supplier_id: activeSupplier.id,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        delivery_date: formData.delivery_date,
        currency: formData.currency,
        buyer_ico: formData.buyer_ico,
        buyer_dic: formData.buyer_dic,
        buyer_ic_dph: formData.buyer_ic_dph,
        buyer_name: formData.buyer_name,
        buyer_street: formData.buyer_street,
        buyer_city: formData.buyer_city,
        buyer_postal_code: formData.buyer_postal_code,
        buyer_country_code: formData.buyer_country_code,
        buyer_email: formData.buyer_email,
        buyer_peppol_id: formData.buyer_peppol_id,
        order_reference: formData.order_reference,
        buyer_reference: formData.buyer_reference,
        payment_means_code: formData.payment_means_code,
        bank_name: formData.bank_name,
        iban: formData.iban,
        swift: formData.swift,
        variable_symbol: formData.variable_symbol,
        total_without_vat: totals.withoutVat,
        total_vat: totals.vat,
        total_with_vat: totals.withVat,
        global_discount_percent: formData.global_discount_percent || 0,
        global_discount_amount: totals.withoutVat > 0 ? Math.round((formData.items.reduce((s, i) => s + i.quantity * i.unit_price - (i.discount_amount || 0), 0)) * (formData.global_discount_percent || 0) / 100 * 100) / 100 : 0,
        note: formData.note,
        status: 'draft',
        invoice_mode: formData.invoice_mode || 'standard',
        invoice_type_code: formData.invoice_type_code || '380',
        correction_of: formData.correction_of || null,
        correction_reason: formData.correction_reason || null,
        billing_reference_number: formData.billing_reference_number || null,
        billing_reference_date: formData.billing_reference_date || null,
        attachments: formData.attachments || [],
      }

      let invoiceId: string

      if (isEditMode && editId) {
        // Update existing invoice
        const { error } = await supabase
          .from('invoices')
          .update({ ...invoicePayload, xml_content: null, validation_errors: null })
          .eq('id', editId)
        if (error) throw error
        invoiceId = editId

        // Delete old items and re-insert
        await supabase.from('invoice_items').delete().eq('invoice_id', editId)
      } else {
        // Create new invoice
        const year = new Date().getFullYear()
        const seqNum = parseInt(formData.invoice_number.split('-').pop() || '1')
        const seqPrefix = isCorrectionMode ? 'CN' : 'FV'
        await supabase.from('invoice_sequences').upsert(
          { user_id: user.id, supplier_id: activeSupplier.id, year, last_number: seqNum, prefix: seqPrefix },
          { onConflict: 'user_id,supplier_id,year,prefix' }
        )

        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert(invoicePayload)
          .select()
          .single()
        if (error) throw error
        invoiceId = invoice.id
      }

      const items = formData.items.map((item) => {
        const gross = item.quantity * item.unit_price
        const discountAmt = item.discount_amount || Math.round(gross * (item.discount_percent || 0) / 100 * 100) / 100
        return {
          invoice_id: invoiceId,
          line_number: item.line_number,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_category: item.vat_category,
          vat_rate: item.vat_rate,
          discount_percent: item.discount_percent || 0,
          discount_amount: discountAmt,
          line_total: Math.round((gross - discountAmt) * 100) / 100,
          item_number: item.item_number,
          buyer_item_number: item.buyer_item_number,
        }
      })

      const { error: itemsError } = await supabase.from('invoice_items').insert(items)
      if (itemsError) throw itemsError

      // Auto-generate XML and validate
      try {
        const genRes = await fetch('/api/invoice/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId }),
        })
        const genData = await genRes.json()

        if (genRes.ok && genData.allPassed) {
          // All validation passed -> go to dashboard with success toast
          toast.success(`Faktúra ${formData.invoice_number} bola vytvorená a je validná`)
          router.push('/dashboard')
          return
        }

        // Validation failed -> find first failed rule, redirect back to edit mode
        if (genData.validation) {
          type Phase = { checks: { ruleId: string; passed: boolean; message: string }[] }
          const firstFailed = (genData.validation as Phase[])
            .flatMap((p) => p.checks)
            .find((c) => !c.passed)
          if (firstFailed) {
            const { step: focusStep, field: focusField } = mapRuleToField(firstFailed.ruleId)
            toast.error(firstFailed.message)
            router.push(`/invoices/new?edit=${invoiceId}&focusStep=${focusStep}&focusField=${focusField}`)
            return
          }
        }
      } catch {
        // Generation failed silently, redirect to detail to let user manually retry
      }

      // Fallback: generation error without validation -> go to detail
      toast.warning(isEditMode ? 'Faktúra uložená, ale validácia neprešla' : 'Faktúra vytvorená, ale boli najdené chyby')
      router.push(`/invoices/${invoiceId}`)
    } catch (err) {
      toast.error('Chyba: ' + (err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  if (supplierLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!activeSupplier) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard className="text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Najprv vytvorte dodavateľa</h2>
          <p className="text-muted-foreground mb-6">Pre vystavovanie faktúr je potrebné mat aspoň jedného dodávateľa.</p>
          <Link href="/suppliers/new" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            Pridať dodávateľa
          </Link>
        </GlassCard>
      </div>
    )
  }

  // Build a supplier-shaped object for the summary step (matches CompanyProfile interface)
  const supplierAsProfile = {
    ico: activeSupplier.ico,
    dic: activeSupplier.dic,
    ic_dph: activeSupplier.ic_dph,
    company_name: activeSupplier.company_name,
    street: activeSupplier.street,
    city: activeSupplier.city,
    postal_code: activeSupplier.postal_code,
    country_code: activeSupplier.country_code,
    bank_name: activeSupplier.bank_name,
    iban: activeSupplier.iban,
    swift: activeSupplier.swift,
    email: activeSupplier.email,
    phone: activeSupplier.phone,
    web: activeSupplier.web,
    registration_court: activeSupplier.registration_court,
    registration_number: activeSupplier.registration_number,
    is_vat_payer: activeSupplier.is_vat_payer,
  }

  // Correction wizard callback
  function handleCorrectionApply(updates: Partial<InvoiceFormData>, scenario: CorrectionScenario, docType: '380' | '381' | '384') {
    setFormData((prev) => {
      const updated = { ...prev, ...updates }
      // Update invoice number prefix: FV for re-issued invoice (380), CN for credit note (381)
      if (docType === '380' && updated.invoice_number.startsWith('CN-')) {
        updated.invoice_number = updated.invoice_number.replace('CN-', 'FV-')
        updated.variable_symbol = updated.invoice_number.replace(/\D/g, '').slice(-10)
      }
      return updated
    })
    setCorrectionStep('form')
    // Freeform and Discount already have all data edited -> go directly to Súhrn
    if (scenario === 'freeform' || scenario === 'discount') {
      setStep(3)
    } else {
      setStep(2) // Other scenarios -> Items step for review
    }
  }

  // Direct creation for full_storno - creates credit note immediately without form steps
  async function handleDirectCreate(updates: Partial<InvoiceFormData>, _scenario: CorrectionScenario, _docType: '381'): Promise<{ success: boolean; errors?: string[] }> {
    if (!activeSupplier || !originalInvoice) return { success: false, errors: ['Chýba dodávateľ alebo pôvodná faktúra'] }

    setDirectCreating(true)
    setDirectCreationErrors([])

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nie ste prihlásený')

      // Build full invoice data from original + updates
      const mergedData: InvoiceFormData = {
        ...formData,
        ...updates,
        invoice_type_code: '381',
        buyer_name: originalInvoice.buyer_name,
        buyer_ico: originalInvoice.buyer_ico,
        buyer_dic: originalInvoice.buyer_dic,
        buyer_ic_dph: originalInvoice.buyer_ic_dph,
        buyer_street: originalInvoice.buyer_street,
        buyer_city: originalInvoice.buyer_city,
        buyer_postal_code: originalInvoice.buyer_postal_code,
        buyer_country_code: originalInvoice.buyer_country_code,
        buyer_email: originalInvoice.buyer_email,
        buyer_peppol_id: originalInvoice.buyer_peppol_id,
        buyer_reference: originalInvoice.buyer_reference,
        order_reference: originalInvoice.order_reference,
        delivery_date: originalInvoice.delivery_date || formData.delivery_date,
        payment_means_code: originalInvoice.payment_means_code || formData.payment_means_code,
      }

      // Calculate totals for the credit note
      const items = updates.items || []
      const itemTotals = items.reduce((acc, item) => {
        const lineNet = item.line_total
        const lineVat = Math.round(lineNet * (item.vat_rate / 100) * 100) / 100
        return { net: acc.net + lineNet, vat: acc.vat + lineVat }
      }, { net: 0, vat: 0 })

      const invoicePayload = {
        user_id: user.id,
        supplier_id: activeSupplier.id,
        invoice_number: mergedData.invoice_number,
        issue_date: mergedData.issue_date,
        due_date: mergedData.due_date,
        delivery_date: mergedData.delivery_date,
        currency: mergedData.currency,
        buyer_ico: mergedData.buyer_ico,
        buyer_dic: mergedData.buyer_dic,
        buyer_ic_dph: mergedData.buyer_ic_dph,
        buyer_name: mergedData.buyer_name,
        buyer_street: mergedData.buyer_street,
        buyer_city: mergedData.buyer_city,
        buyer_postal_code: mergedData.buyer_postal_code,
        buyer_country_code: mergedData.buyer_country_code,
        buyer_email: mergedData.buyer_email,
        buyer_peppol_id: mergedData.buyer_peppol_id,
        order_reference: mergedData.order_reference,
        buyer_reference: mergedData.buyer_reference,
        payment_means_code: mergedData.payment_means_code,
        bank_name: mergedData.bank_name,
        iban: mergedData.iban,
        swift: mergedData.swift,
        variable_symbol: mergedData.variable_symbol,
        total_without_vat: Math.round(itemTotals.net * 100) / 100,
        total_vat: Math.round(itemTotals.vat * 100) / 100,
        total_with_vat: Math.round((itemTotals.net + itemTotals.vat) * 100) / 100,
        global_discount_percent: 0,
        global_discount_amount: 0,
        note: mergedData.note,
        status: 'final',
        invoice_mode: mergedData.invoice_mode || 'standard',
        invoice_type_code: '381',
        correction_of: updates.correction_of || null,
        correction_reason: updates.correction_reason || null,
        billing_reference_number: updates.billing_reference_number || null,
        billing_reference_date: updates.billing_reference_date || null,
        attachments: [],
      }

      // Create invoice
      const year = new Date().getFullYear()
      const seqNum = parseInt(mergedData.invoice_number.split('-').pop() || '1')
      await supabase.from('invoice_sequences').upsert(
        { user_id: user.id, supplier_id: activeSupplier.id, year, last_number: seqNum, prefix: 'CN' },
        { onConflict: 'user_id,supplier_id,year,prefix' }
      )

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single()
      if (invoiceError) throw invoiceError

      const invoiceId = invoice.id

      // Insert items
      const dbItems = items.map((item) => {
        const gross = item.quantity * item.unit_price
        const discountAmt = item.discount_amount || Math.round(gross * (item.discount_percent || 0) / 100 * 100) / 100
        return {
          invoice_id: invoiceId,
          line_number: item.line_number,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_category: item.vat_category,
          vat_rate: item.vat_rate,
          discount_percent: item.discount_percent || 0,
          discount_amount: discountAmt,
          line_total: Math.round((gross - discountAmt) * 100) / 100,
          item_number: item.item_number,
          buyer_item_number: item.buyer_item_number,
        }
      })

      const { error: itemsError } = await supabase.from('invoice_items').insert(dbItems)
      if (itemsError) throw itemsError

      // Generate XML and validate
      const genRes = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const genData = await genRes.json()

      if (genRes.ok && genData.allPassed) {
        // Validation passed -> redirect to invoice detail
        toast.success(`Dobropis ${mergedData.invoice_number} bol vytvorený a je validný`)
        router.push(`/invoices/${invoiceId}`)
        return { success: true }
      }

      // Validation failed -> extract errors and show in wizard
      if (genData.validation) {
        type Phase = { checks?: { ruleId: string; passed: boolean; message: string }[] }
        const failedChecks = (genData.validation as Phase[])
          .flatMap((p) => p.checks || [])
          .filter((c) => c && !c.passed)
          .map((c) => c.message)

        // Delete the invalid invoice
        await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
        await supabase.from('invoices').delete().eq('id', invoiceId)

        setDirectCreationErrors(failedChecks.length > 0 ? failedChecks : ['Validácia zlyhala'])
        return { success: false, errors: failedChecks.length > 0 ? failedChecks : ['Validácia zlyhala'] }
      }

      // Unknown error
      setDirectCreationErrors(['Neznáma chyba pri validácii'])
      return { success: false, errors: ['Neznáma chyba pri validácii'] }
    } catch (err) {
      const errMsg = (err as Error).message
      setDirectCreationErrors([errMsg])
      return { success: false, errors: [errMsg] }
    } finally {
      setDirectCreating(false)
    }
  }

  // If in correction wizard mode, show the wizard first
  if (isCorrectionMode && correctionStep === 'wizard' && originalInvoice) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Opravná faktúra</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dodavatel: <span className="text-foreground font-medium">{activeSupplier.company_name}</span>
          </p>
        </div>
        <CorrectionWizard 
          original={originalInvoice} 
          onApply={handleCorrectionApply}
          onDirectCreate={handleDirectCreate}
          isCreating={directCreating}
          creationErrors={directCreationErrors}
        />
      </div>
    )
  }

  const buyerStepLabel = isSelfBilling ? 'Dodávateľ' : 'Odberateľ'
  const steps = [
    { label: 'Základné údaje', component: <StepBasicInfo formData={formData} updateForm={updateForm} invoiceMode={invoiceMode} /> },
    { label: buyerStepLabel, component: <StepBuyer formData={formData} updateForm={updateForm} supplierId={activeSupplier.id} supplierIco={activeSupplier.ico} invoiceMode={invoiceMode} /> },
    { label: 'Položky', component: <StepItems formData={formData} updateForm={updateForm} totals={totals} isVatPayer={isVatPayer} invoiceMode={invoiceMode} isCorrectionMode={isCorrectionMode} /> },
    { label: 'Súhrn', component: <StepSummary formData={formData} profile={supplierAsProfile} totals={totals} isVatPayer={isVatPayer} invoiceMode={invoiceMode} /> },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">
          {isEditMode ? 'Upraviť faktúru' : isCorrectionMode ? 'Opravná faktúra' : isSelfBilling ? 'Samofakturácia' : isReverseCharge ? 'Prenesenie daň. povinnosti' : 'Nová faktúra'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isSelfBilling ? `Odberateľ: ${activeSupplier.company_name}` : activeSupplier.company_name}
        </p>
      </div>

      <InvoiceWizardStepper steps={steps.map((s) => s.label)} currentStep={step} />

      <div>{steps[step]?.component ?? steps[0].component}</div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-6 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors disabled:opacity-30"
        >
          Späť
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Ďalej
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating || !formData.buyer_name || formData.items.length === 0}
            className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {creating ? 'Vytváram a validujem...' : isEditMode ? 'Uložiť zmeny' : isCorrectionMode ? 'Vytvoriť opravnú faktúru' : isSelfBilling ? 'Vytvoriť samofaktúru' : isReverseCharge ? 'Vytvoriť faktúru (prenesenie DPH)' : 'Vytvoriť a validovať'}
          </button>
        )}
      </div>
    </div>
  )
}
