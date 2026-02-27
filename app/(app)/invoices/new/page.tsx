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
import { useActiveSupplier, type Supplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import type { InvoiceFormData } from '@/lib/schemas'
import Link from 'next/link'

const defaultItem = {
  line_number: 1,
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

export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { activeSupplier, loading: supplierLoading } = useActiveSupplier()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const duplicateId = searchParams.get('duplicate')
  const editId = searchParams.get('edit')
  const isEditMode = !!editId

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
    note: null,
    items: [{ ...defaultItem }],
  })

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
          items: srcItems?.length ? srcItems.map((it: Record<string, unknown>, idx: number) => ({
            line_number: idx + 1,
            description: it.description as string,
            quantity: it.quantity as number,
            unit: (it.unit as string) || 'C62',
            unit_price: it.unit_price as number,
            vat_category: (it.vat_category as string) || 'S',
            vat_rate: (it.vat_rate as number) || 20,
            line_total: (it.quantity as number) * (it.unit_price as number),
            item_number: (it.item_number as string) || null,
            buyer_item_number: (it.buyer_item_number as string) || null,
          })) : [{ ...defaultItem }],
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
          items: srcItems?.length ? srcItems.map((it: Record<string, unknown>, idx: number) => ({
            line_number: idx + 1,
            description: it.description as string,
            quantity: it.quantity as number,
            unit: (it.unit as string) || 'C62',
            unit_price: it.unit_price as number,
            vat_category: (it.vat_category as string) || 'S',
            vat_rate: (it.vat_rate as number) || 20,
            line_total: (it.quantity as number) * (it.unit_price as number),
            item_number: (it.item_number as string) || null,
            buyer_item_number: (it.buyer_item_number as string) || null,
          })) : [{ ...defaultItem }],
        }))
        toast.success('Udaje z povodnej faktury boli nacitane')
      }
    }

    // Generate invoice number scoped to supplier
    const year = new Date().getFullYear()
    const { data: seq } = await supabase
      .from('invoice_sequences')
      .select('*')
      .eq('user_id', user.id)
      .eq('supplier_id', activeSupplier.id)
      .eq('year', year)
      .maybeSingle()

    let nextNum = 1
    if (seq) {
      nextNum = (seq.last_number || 0) + 1
    }

    const invoiceNumber = `FV-${year}-${String(nextNum).padStart(4, '0')}`
    setFormData((prev) => ({
      ...prev,
      invoice_number: invoiceNumber,
      variable_symbol: invoiceNumber.replace(/\D/g, '').slice(-10),
    }))

    setLoading(false)
  }, [supabase, router, activeSupplier, duplicateId, editId])

  useEffect(() => {
    if (!supplierLoading) loadData()
  }, [loadData, supplierLoading])

  function updateForm(updates: Partial<InvoiceFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const totals = formData.items.reduce(
    (acc, item) => {
      const lineTotal = item.quantity * item.unit_price
      const vatAmount = lineTotal * (item.vat_rate / 100)
      return {
        withoutVat: acc.withoutVat + lineTotal,
        vat: acc.vat + vatAmount,
        withVat: acc.withVat + lineTotal + vatAmount,
      }
    },
    { withoutVat: 0, vat: 0, withVat: 0 }
  )

  async function handleCreate() {
    if (!activeSupplier) return
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
        note: formData.note,
        status: 'draft',
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
        await supabase.from('invoice_sequences').upsert(
          { user_id: user.id, supplier_id: activeSupplier.id, year, last_number: seqNum, prefix: 'FV' },
          { onConflict: 'user_id,supplier_id,year' }
        )

        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert(invoicePayload)
          .select()
          .single()
        if (error) throw error
        invoiceId = invoice.id
      }

      const items = formData.items.map((item) => ({
        invoice_id: invoiceId,
        line_number: item.line_number,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        vat_category: item.vat_category,
        vat_rate: item.vat_rate,
        line_total: item.quantity * item.unit_price,
        item_number: item.item_number,
        buyer_item_number: item.buyer_item_number,
      }))

      const { error: itemsError } = await supabase.from('invoice_items').insert(items)
      if (itemsError) throw itemsError

      toast.success(isEditMode ? 'Faktura bola aktualizovana' : 'Faktura bola vytvorena')
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
          <h2 className="text-lg font-semibold text-foreground mb-2">Najprv vytvorte dodavatela</h2>
          <p className="text-muted-foreground mb-6">Pre vystavovanie faktur je potrebne mat aspon jedneho dodavatela.</p>
          <Link href="/suppliers/new" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            Pridat dodavatela
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
  }

  const steps = [
    { label: 'Zakladne udaje', component: <StepBasicInfo formData={formData} updateForm={updateForm} /> },
    { label: 'Odberatel', component: <StepBuyer formData={formData} updateForm={updateForm} supplierId={activeSupplier.id} /> },
    { label: 'Polozky', component: <StepItems formData={formData} updateForm={updateForm} totals={totals} /> },
    { label: 'Suhrn', component: <StepSummary formData={formData} profile={supplierAsProfile} totals={totals} /> },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{isEditMode ? 'Upravit fakturu' : 'Nova faktura'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dodavatel: <span className="text-foreground font-medium">{activeSupplier.company_name}</span>
        </p>
      </div>

      <InvoiceWizardStepper steps={steps.map((s) => s.label)} currentStep={step} />

      <div>{steps[step].component}</div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-6 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors disabled:opacity-30"
        >
          Spat
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Dalej
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating || !formData.buyer_name || formData.items.length === 0}
            className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode ? 'Ulozit zmeny' : 'Vytvorit fakturu'}
          </button>
        )}
      </div>
    </div>
  )
}
