'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, CheckCircle2, XCircle, Clock, Search, Download, Building2, Trash2, RotateCcw, ChevronRight, Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveSupplier } from '@/lib/supplier-context'
import { DashboardSkeleton } from '@/components/skeleton'
import { fmtDate } from '@/lib/utils'

const PAGE_SIZE = 20

const SK_MONTHS = [
  'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
  'Júl', 'August', 'September', 'Október', 'November', 'December',
]

interface Invoice {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  buyer_name: string
  total_with_vat: number
  currency: string
  status: string
  created_at: string
  correction_of: string | null
  invoice_type_code: string | null
  peppol_sent_at: string | null
  peppol_send_status: string | null
}

function monthKey(dateStr: string) {
  const [y, m] = dateStr.split('-')
  return `${y}-${m}`
}
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return `${SK_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'valid' || status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-xs font-medium">
        <CheckCircle2 className="w-3 h-3" />
        {status === 'sent' ? 'Odoslaná' : 'Validná'}
      </span>
    )
  }
  if (status === 'invalid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
        <XCircle className="w-3 h-3" />
        Chyba
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-medium">
      <Clock className="w-3 h-3" />
      Koncept
    </span>
  )
}

const fmt = (n: number) =>
  n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { activeSupplier, suppliers, loading: supplierLoading } = useActiveSupplier()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadData = useCallback(async (pageNum = 1, append = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (!activeSupplier) { setLoading(false); return }

    if (pageNum > 1) setLoadingMore(true)

    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE

    const { data: invs } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .eq('supplier_id', activeSupplier.id)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    const fetched = invs || []
    setHasMore(fetched.length > PAGE_SIZE)
    const trimmed = fetched.slice(0, PAGE_SIZE)

    if (append) {
      setInvoices((prev) => [...prev, ...trimmed])
    } else {
      setInvoices(trimmed)
    }
    setPage(pageNum)
    setLoading(false)
    setLoadingMore(false)
  }, [supabase, router, activeSupplier])

  useEffect(() => {
    if (!supplierLoading) {
      setLoading(true)
      setPage(1)
      loadData(1, false)
    }
  }, [loadData, supplierLoading])

  function handleLoadMore() {
    loadData(page + 1, true)
  }

  const filtered = search
    ? invoices.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
          inv.buyer_name.toLowerCase().includes(search.toLowerCase())
      )
    : invoices

  // Build parent -> corrections map
  const correctionsMap = new Map<string, Invoice[]>()
  const correctionIds = new Set<string>()
  for (const inv of filtered) {
    if (inv.correction_of) {
      correctionIds.add(inv.id)
      if (!correctionsMap.has(inv.correction_of)) correctionsMap.set(inv.correction_of, [])
      correctionsMap.get(inv.correction_of)!.push(inv)
    }
  }

  // Group by month (only top-level invoices; corrections rendered under their parent)
  const grouped = new Map<string, Invoice[]>()
  for (const inv of filtered) {
    if (correctionIds.has(inv.id)) continue // skip corrections from top level
    const key = monthKey(inv.issue_date)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(inv)
  }

  async function handleDelete(e: React.MouseEvent, inv: Invoice) {
    e.stopPropagation()
    if (!confirm(`Naozaj chcete zmazat fakturu ${inv.invoice_number}?`)) return
    await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) {
      toast.error('Chyba pri mazani: ' + error.message)
    } else {
      toast.success('Faktura bola zmazana')
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id))
    }
  }

  function exportCSV() {
    if (filtered.length === 0) return
    const header = 'Cislo faktury;Odberatel;Datum vystavenia;Datum splatnosti;Suma;Mena;Stav'
    const rows = filtered.map((inv) =>
      `${inv.invoice_number};${inv.buyer_name};${fmtDate(inv.issue_date)};${fmtDate(inv.due_date)};${inv.total_with_vat};${inv.currency};${inv.status}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faktury-${activeSupplier?.company_name || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (supplierLoading || loading) {
    return <DashboardSkeleton />
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Building2 className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Vitajte v Peppol Faktúra</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Začnite pridaním firmy, za ktorú budete vystavovať faktúry.
        </p>
        <Link
          href="/suppliers/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Pridať dodávateľa
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active supplier header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">{activeSupplier?.company_name}</h1>
          <p className="text-sm text-muted-foreground">
            ICO: {activeSupplier?.ico}
            {activeSupplier?.is_vat_payer === false && (
              <span className="ml-2 text-xs text-warning">Neplatca DPH</span>  
            )}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          title="Exportovat CSV"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Hľadať faktúru alebo odberateľa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Invoice list grouped by month */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {invoices.length === 0 ? 'Zatiaľ žiadne faktúry' : 'Žiadne výsledky'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([key, monthInvoices]) => (
            <div key={key}>
              {/* Sticky month header */}
              <div className="sticky top-12 z-10 py-1.5 -mx-3 px-3 bg-background/80 backdrop-blur-sm">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {monthLabel(key)}
                </span>
              </div>

              {/* Invoice rows as cards */}
              <div className="glass-card rounded-2xl divide-y divide-border overflow-hidden">
                {monthInvoices.map((inv) => {
                  const corrections = correctionsMap.get(inv.id) || []
                  const hasCorrections = corrections.length > 0
                  return (
                    <div key={inv.id}>
                      {/* Parent invoice row */}
                      <div
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium font-mono text-foreground">
                              {inv.invoice_number}
                            </span>
                            <StatusBadge status={inv.status} />
                            {inv.peppol_sent_at && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium"
                                title={`Zaslané cez Peppol ${new Date(inv.peppol_sent_at).toLocaleString('sk-SK')}`}
                              >
                                <Globe className="w-3 h-3" />
                                Peppol
                              </span>
                            )}
                            {hasCorrections && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
                                {corrections.length}x dobropis
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{inv.buyer_name}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{fmt(inv.total_with_vat)}</p>
                            <p className="text-xs text-muted-foreground">{inv.currency}</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {(inv.status === 'valid' || inv.status === 'sent') && !inv.correction_of && (
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/invoices/new?correct=${inv.id}`) }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                title="Vytvorit dobropis"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(e, inv)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Zmazat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      </div>

                      {/* Indented correction rows */}
                      {corrections.map((cn) => (
                        <div
                          key={cn.id}
                          onClick={() => router.push(`/invoices/${cn.id}`)}
                          className="flex items-center gap-3 pl-7 pr-3 py-2.5 cursor-pointer hover:bg-secondary/40 active:bg-secondary/60 transition-colors border-t border-border/50"
                        >
                          <div className="w-4 flex items-center justify-center shrink-0">
                            <RotateCcw className="w-3 h-3 text-amber-500/60" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium font-mono text-muted-foreground">
                                {cn.invoice_number}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
                                Dobropis
                              </span>
                              <StatusBadge status={cn.status} />
                              {cn.peppol_sent_at && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium"
                                  title={`Zaslané cez Peppol ${new Date(cn.peppol_sent_at).toLocaleString('sk-SK')}`}
                                >
                                  <Globe className="w-3 h-3" />
                                  Peppol
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{cn.buyer_name}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-bold text-destructive">-{fmt(Math.abs(cn.total_with_vat))}</p>
                              <p className="text-[10px] text-muted-foreground">{cn.currency}</p>
                            </div>
                            <button
                              onClick={(e) => handleDelete(e, cn)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Zmazat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && !search && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl glass-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Načítať ďalšie'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
