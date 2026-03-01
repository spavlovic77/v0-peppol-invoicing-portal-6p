'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Zap, ArrowLeft, CheckCircle2, XCircle, Copy,
  Pencil, Trash2, Globe, RotateCcw,
} from 'lucide-react'
import { GlassCard } from '@/components/glass-card'
import { ValidationPipeline } from '@/components/invoice/validation-pipeline'
import { DownloadActions } from '@/components/invoice/download-actions'
import { InvoiceDetailSkeleton } from '@/components/skeleton'
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
  supplier_id: string | null
  peppol_send_status: string | null
  peppol_transaction_id: string | null
  peppol_sent_at: string | null
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
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

    setInvoice(inv)
    if (inv.validation_errors) setValidation(inv.validation_errors)

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

  useEffect(() => { loadInvoice() }, [loadInvoice])

  async function handleGenerate() {
    if (!invoice) return
    setGenerating(true)
    setValidation(null)

    try {
      const res = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba pri generovani')

      setValidation(data.validation)
      toast.success(data.allPassed ? 'Faktura validna' : 'Najdene problemy')
      loadInvoice()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete() {
    if (!invoice) return
    if (!confirm(`Naozaj chcete zmazat fakturu ${invoice.invoice_number}?`)) return
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
      toast.success('Faktura odoslana na Peppol siet')
      await loadInvoice()
      if (data.transactionId) pollDeliveryStatus(data.transactionId, invoice.id)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const pollingRef = React.useRef(false)

  async function pollDeliveryStatus(txId: string, invId: string) {
    if (pollingRef.current) return
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
          toast[data.status === 'delivered' ? 'success' : 'error'](
            data.status === 'delivered' ? 'Faktura dorucena cez Peppol' : 'Dorucenie zlyhalo'
          )
          return
        }
        if (attempts < maxAttempts) setTimeout(poll, 5000)
        else { pollingRef.current = false; setPolling(false); toast.info('Skontrolujte neskor.') }
      } catch {
        pollingRef.current = false
        setPolling(false)
      }
    }
    poll()
  }

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

  if (loading) return <InvoiceDetailSkeleton />
  if (!invoice) return null

  const statusColor =
    invoice.status === 'valid' || invoice.status === 'sent'
      ? 'text-success bg-success/15'
      : invoice.status === 'invalid'
      ? 'text-destructive bg-destructive/15'
      : 'text-warning bg-warning/15'

  const statusLabel =
    invoice.status === 'valid' ? 'Validna'
      : invoice.status === 'sent' ? 'Odoslana'
      : invoice.status === 'invalid' ? 'Nevalidna'
      : 'Koncept'

  const isValid = invoice.status === 'valid' || invoice.status === 'sent'
  const isCreditNote = invoice.invoice_number.startsWith('CN-')
  const allPassed = Array.isArray(validation) && (validation as Array<{ passed: boolean }>).every((p) => p.passed)
  const hasFailures = Array.isArray(validation) && !allPassed

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Faktury
        </button>
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-foreground font-mono">{invoice.invoice_number}</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Compact summary card */}
      <GlassCard>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{invoice.buyer_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {invoice.issue_date} {'>'} {invoice.due_date}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-primary">{fmt(invoice.total_with_vat)}</p>
            <p className="text-xs text-muted-foreground">{invoice.currency}</p>
          </div>
        </div>
        {invoice.total_vat > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
            <span>Zaklad: {fmt(invoice.total_without_vat)}</span>
            <span>DPH: {fmt(invoice.total_vat)}</span>
          </div>
        )}
      </GlassCard>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {(invoice.status === 'draft' || invoice.status === 'invalid') && (
          <Link
            href={`/invoices/new?edit=${invoice.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Upravit
          </Link>
        )}
        <Link
          href={`/invoices/new?duplicate=${invoice.id}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-sm text-foreground hover:bg-secondary transition-colors"
        >
          <Copy className="w-3.5 h-3.5" /> Duplikovat
        </Link>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Zmazat
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ml-auto ${
            invoice.status === 'invalid'
              ? 'bg-warning text-warning-foreground hover:bg-warning/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {generating ? 'Generujem...' : invoice.xml_content ? 'Regenerovat XML' : 'Generovat XML'}
        </button>
      </div>

      {/* Validation: only when generating or FAILED */}
      {generating && !validation && (
        <ValidationPipeline phases={[]} isGenerating />
      )}
      {hasFailures && (
        <ValidationPipeline
          phases={Array.isArray(validation) ? validation : []}
          isGenerating={false}
        />
      )}

      {/* Download actions */}
      {invoice.xml_content && (
        <DownloadActions
          invoice={invoice}
          hasApKey={hasApKey}
          peppolStatus={invoice.peppol_send_status}
          onSendPeppol={handleSendPeppol}
          sending={sending}
        />
      )}

      {/* Dobropis button -- only for valid non-credit-note invoices */}
      {isValid && !isCreditNote && (
        <Link
          href={`/invoices/new?correct=${invoice.id}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-warning/15 text-warning font-medium text-sm hover:bg-warning/25 transition-colors border border-warning/20"
        >
          <RotateCcw className="w-4 h-4" />
          Vytvorit opravny doklad (dobropis)
        </Link>
      )}

      {/* Peppol delivery status */}
      {invoice.peppol_send_status && (
        <GlassCard className={
          invoice.peppol_send_status === 'delivered' ? 'border-success/30'
          : invoice.peppol_send_status === 'failed' ? 'border-destructive/30'
          : 'border-primary/30'
        }>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">Peppol</span>
                {invoice.peppol_send_status === 'sent' && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {polling && <Loader2 className="w-3 h-3 animate-spin" />}
                    Odoslane
                  </span>
                )}
                {invoice.peppol_send_status === 'delivered' && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="w-3 h-3" /> Dorucene
                  </span>
                )}
                {invoice.peppol_send_status === 'failed' && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="w-3 h-3" /> Zlyhalo
                  </span>
                )}
              </div>
              {invoice.peppol_sent_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(invoice.peppol_sent_at).toLocaleString('sk-SK')}
                </p>
              )}
            </div>
            {invoice.peppol_send_status === 'failed' && hasApKey && (
              <button
                onClick={handleSendPeppol}
                disabled={sending}
                className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
              >
                Znova
              </button>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
