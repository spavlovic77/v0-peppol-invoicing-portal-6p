'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Download, FileText, FileCode, Sparkles, ArrowLeft, CheckCircle2, XCircle, Copy } from 'lucide-react'
import { GlassCard } from '@/components/glass-card'
import { ValidationDisplay } from '@/components/invoice/validation-display'
import Link from 'next/link'

interface InvoiceData {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  delivery_date: string | null
  currency: string
  buyer_name: string
  buyer_ico: string | null
  buyer_dic: string | null
  buyer_ic_dph: string | null
  buyer_street: string | null
  buyer_city: string | null
  buyer_postal_code: string | null
  buyer_country_code: string
  total_without_vat: number
  total_vat: number
  total_with_vat: number
  status: string
  xml_content: string | null
  validation_errors: unknown
  note: string | null
  bank_name: string | null
  iban: string | null
  swift: string | null
  variable_symbol: string | null
}

interface InvoiceItem {
  id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number
  line_total: number
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [validation, setValidation] = useState<unknown>(null)

  const loadInvoice = useCallback(async () => {
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', params.id as string)
      .single()

    if (!inv) {
      toast.error('Faktura nenajdena')
      router.push('/dashboard')
      return
    }

    const { data: itms } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', params.id as string)
      .order('line_number')

    setInvoice(inv)
    setItems(itms || [])
    if (inv.validation_errors) {
      setValidation(inv.validation_errors)
    }
    setLoading(false)
  }, [supabase, params.id, router])

  useEffect(() => {
    loadInvoice()
  }, [loadInvoice])

  async function handleGenerate() {
    if (!invoice) return
    setGenerating(true)

    try {
      const res = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Chyba pri generovani')
      }

      setValidation(data.validation)
      toast.success(data.allPassed ? 'Faktura uspesne vygenerovana a validna' : 'Faktura vygenerovana s chybami')
      loadInvoice()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function downloadXml() {
    if (!invoice?.xml_content) return
    const blob = new Blob([invoice.xml_content], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadPdf() {
    if (!invoice) return
    try {
      const res = await fetch(`/api/invoice/pdf?id=${invoice.id}`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Chyba pri generovani PDF: ' + (err as Error).message)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!invoice) return null

  const statusColor =
    invoice.status === 'valid'
      ? 'text-success bg-success/20'
      : invoice.status === 'invalid'
      ? 'text-destructive bg-destructive/20'
      : 'text-warning bg-warning/20'

  const statusLabel =
    invoice.status === 'valid' ? 'Validna' : invoice.status === 'invalid' ? 'Nevalidna' : 'Koncept'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Spat na prehlad
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            Faktura {invoice.invoice_number}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            {invoice.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-success" />}
            {invoice.status === 'invalid' && <XCircle className="w-4 h-4 text-destructive" />}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/invoices/new?duplicate=${invoice.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden md:inline">Duplikovat</span>
          </Link>
          {!invoice.xml_content && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'Generujem...' : 'Generovat Peppol XML'}
            </button>
          )}

          {invoice.xml_content && (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Regenerovat
              </button>
              <button
                onClick={downloadXml}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors"
              >
                <FileCode className="w-4 h-4" />
                XML
              </button>
              <button
                onClick={downloadPdf}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid md:grid-cols-3 gap-6">
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Datum vystavenia</div>
          <div className="text-foreground font-medium">{invoice.issue_date}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Datum splatnosti</div>
          <div className="text-foreground font-medium">{invoice.due_date}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Na uhradu</div>
          <div className="text-xl font-bold text-primary">
            {fmt(invoice.total_with_vat)} {invoice.currency}
          </div>
        </GlassCard>
      </div>

      {/* Buyer */}
      <GlassCard>
        <h2 className="font-semibold text-foreground mb-3">Odberatel</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-foreground font-medium">{invoice.buyer_name}</div>
            {invoice.buyer_street && <div className="text-muted-foreground">{invoice.buyer_street}</div>}
            <div className="text-muted-foreground">
              {invoice.buyer_postal_code} {invoice.buyer_city}
            </div>
          </div>
          <div className="space-y-1">
            {invoice.buyer_ico && <div className="text-muted-foreground">ICO: {invoice.buyer_ico}</div>}
            {invoice.buyer_dic && <div className="text-muted-foreground">DIC: {invoice.buyer_dic}</div>}
            {invoice.buyer_ic_dph && <div className="text-muted-foreground">IC DPH: {invoice.buyer_ic_dph}</div>}
          </div>
        </div>
      </GlassCard>

      {/* Items */}
      <GlassCard>
        <h2 className="font-semibold text-foreground mb-3">Polozky</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Popis</th>
                <th className="pb-2 font-medium text-right">Mn.</th>
                <th className="pb-2 font-medium text-right">Cena</th>
                <th className="pb-2 font-medium text-right">DPH</th>
                <th className="pb-2 font-medium text-right">Spolu</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 text-foreground">{item.description}</td>
                  <td className="py-2 text-right text-foreground">{item.quantity}</td>
                  <td className="py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                  <td className="py-2 text-right text-muted-foreground">{item.vat_rate}%</td>
                  <td className="py-2 text-right text-foreground font-medium">{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zaklad dane:</span>
            <span className="text-foreground">{fmt(invoice.total_without_vat)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">DPH:</span>
            <span className="text-foreground">{fmt(invoice.total_vat)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span className="text-foreground">Na uhradu:</span>
            <span className="text-primary">{fmt(invoice.total_with_vat)} {invoice.currency}</span>
          </div>
        </div>
      </GlassCard>

      {/* Validation Results */}
      {validation && Array.isArray(validation) && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            <Download className="w-5 h-5 inline mr-2" />
            Validacia faktury
          </h2>
          <ValidationDisplay phases={validation} />
        </div>
      )}

      {/* XML Preview */}
      {invoice.xml_content && (
        <GlassCard>
          <h2 className="font-semibold text-foreground mb-3">Peppol XML nahled</h2>
          <div className="max-h-80 overflow-auto rounded-lg bg-background/50 p-4">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {invoice.xml_content.slice(0, 3000)}
              {invoice.xml_content.length > 3000 && '\n\n... (skratene)'}
            </pre>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
