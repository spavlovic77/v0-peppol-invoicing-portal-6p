'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, FileText, FileCode, Sparkles, ArrowLeft, CheckCircle2, XCircle, Copy, Pencil, Trash2, Send, Globe } from 'lucide-react'
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
  ai_prompt_tokens: number | null
  ai_completion_tokens: number | null
  ai_total_tokens: number | null
  ai_cost_usd: number | null
  ai_model: string | null
  supplier_id: string | null
  peppol_send_status: string | null
  peppol_transaction_id: string | null
  peppol_sent_at: string | null
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
  const [sending, setSending] = useState(false)
  const [polling, setPolling] = useState(false)
  const [hasApKey, setHasApKey] = useState(false)

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

    // Check if the supplier has an AP API key
    if (inv.supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('ap_api_key')
        .eq('id', inv.supplier_id)
        .single()
      setHasApKey(!!supplier?.ap_api_key)
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

  async function handleDelete() {
    if (!invoice) return
    if (!confirm(`Naozaj chcete zmazat fakturu ${invoice.invoice_number}? Tuto akciu nie je mozne vratit.`)) return
    // Delete items first (cascade should handle it, but be explicit)
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
    if (error) {
      toast.error('Chyba pri mazani: ' + error.message)
    } else {
      toast.success('Faktura bola zmazana')
      router.push('/dashboard')
    }
  }

  async function handleSendPeppol() {
    if (!invoice) return
    if (!confirm('Odoslat fakturu cez Peppol siet?')) return
    setSending(true)
    try {
      const res = await fetch('/api/peppol/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba pri odosielani')

      toast.success('Faktura bola odoslana na Peppol siet')
      await loadInvoice()

      // Start polling for delivery status
      if (data.transactionId) {
        pollDeliveryStatus(data.transactionId, invoice.id)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const pollingRef = React.useRef(false)

  async function pollDeliveryStatus(txId: string, invId: string) {
    if (pollingRef.current) return // prevent double-polling
    pollingRef.current = true
    setPolling(true)
    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      attempts++
      try {
        const res = await fetch(`/api/peppol/status?invoiceId=${invId}&transactionId=${txId}`)
        const data = await res.json()

        if (data.status === 'delivered' || data.status === 'failed') {
          pollingRef.current = false
          setPolling(false)
          await loadInvoice()
          if (data.status === 'delivered') {
            toast.success('Faktura bola uspesne dorucena cez Peppol')
          } else {
            toast.error('Dorucenie faktury zlyhalo')
          }
          return
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // poll every 5s
        } else {
          pollingRef.current = false
          setPolling(false)
          toast.info('Overenie dorucenia trva dlhsie. Skontrolujte neskor.')
        }
      } catch {
        pollingRef.current = false
        setPolling(false)
      }
    }

    poll()
  }

  // Auto-poll if invoice was already sent but pending (only once on mount)
  const autoPolledRef = React.useRef(false)
  useEffect(() => {
    if (autoPolledRef.current) return
    if (invoice?.peppol_send_status === 'sent' && invoice?.peppol_transaction_id) {
      autoPolledRef.current = true
      pollDeliveryStatus(invoice.peppol_transaction_id, invoice.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.peppol_send_status])

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
      <div className="space-y-4">
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Spat na prehlad
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
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

        <div className="flex flex-wrap gap-2">
          {invoice.status === 'draft' && (
            <Link
              href={`/invoices/new?edit=${invoice.id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden md:inline">Upravit</span>
            </Link>
          )}
          <Link
            href={`/invoices/new?duplicate=${invoice.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden md:inline">Duplikovat</span>
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-muted-foreground font-medium hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden md:inline">Zmazat</span>
          </button>
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
                disabled={invoice.status === 'invalid'}
                title={invoice.status === 'invalid' ? 'Faktura obsahuje validacne chyby' : 'Stiahnut XML'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-foreground font-medium hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <FileCode className="w-4 h-4" />
                XML
              </button>
              <button
                onClick={downloadPdf}
                disabled={invoice.status === 'invalid'}
                title={invoice.status === 'invalid' ? 'Faktura obsahuje validacne chyby' : 'Stiahnut PDF'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/40"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              {hasApKey && invoice.status === 'valid' && !invoice.peppol_send_status && (
                <button
                  onClick={handleSendPeppol}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success text-white font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Odosielam...' : 'Odoslat cez Peppol'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Validation Accordion */}
      {validation && Array.isArray(validation) && (
        <ValidationDisplay phases={validation} />
      )}

      {/* Peppol Delivery Status */}
      {invoice.peppol_send_status && (
        <GlassCard className={
          invoice.peppol_send_status === 'delivered' ? 'border-success/30' :
          invoice.peppol_send_status === 'failed' ? 'border-destructive/30' :
          'border-primary/30'
        }>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground text-sm">Peppol dorucenie</h2>
                {invoice.peppol_send_status === 'sent' && (
                  <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {polling && <Loader2 className="w-3 h-3 animate-spin" />}
                    Odoslane
                  </span>
                )}
                {invoice.peppol_send_status === 'delivered' && (
                  <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="w-3 h-3" />
                    Dorucene
                  </span>
                )}
                {invoice.peppol_send_status === 'failed' && (
                  <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="w-3 h-3" />
                    Zlyhalo
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {invoice.peppol_sent_at && `Odoslane: ${new Date(invoice.peppol_sent_at).toLocaleString('sk-SK')}`}
                {invoice.peppol_transaction_id && (
                  <span className="ml-2 font-mono">TX: {invoice.peppol_transaction_id.slice(0, 12)}...</span>
                )}
              </div>
              {polling && (
                <div className="text-xs text-primary mt-1">Overujem dorucenie...</div>
              )}
            </div>
            {invoice.peppol_send_status === 'failed' && hasApKey && (
              <button
                onClick={handleSendPeppol}
                disabled={sending}
                className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
              >
                Skusit znova
              </button>
            )}
          </div>
        </GlassCard>
      )}

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

      {/* AI Cost Info */}
      {invoice.ai_total_tokens && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">AI generovanie</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Model</div>
              <div className="text-foreground font-mono text-xs">{invoice.ai_model || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Vstupne tokeny</div>
              <div className="text-foreground font-medium">
                {(invoice.ai_prompt_tokens || 0).toLocaleString('sk-SK')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Vystupne tokeny</div>
              <div className="text-foreground font-medium">
                {(invoice.ai_completion_tokens || 0).toLocaleString('sk-SK')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Celkom tokeny</div>
              <div className="text-foreground font-medium">
                {(invoice.ai_total_tokens || 0).toLocaleString('sk-SK')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Naklady</div>
              <div className="text-primary font-bold">
                ${(invoice.ai_cost_usd || 0).toFixed(4)}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

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


    </div>
  )
}
