'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, CheckCircle2, XCircle, Clock, Search, Download, Building2, Trash2, RotateCcw, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveSupplier } from '@/lib/supplier-context'
import { DashboardSkeleton } from '@/components/skeleton'

const PAGE_SIZE = 20

const SK_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Jun',
  'Jul', 'August', 'September', 'Oktober', 'November', 'December',
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
        {status === 'sent' ? 'Odoslana' : 'Validna'}
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

  // Group by month
  const grouped = new Map<string, Invoice[]>()
  for (const inv of filtered) {
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
      `${inv.invoice_number};${inv.buyer_name};${inv.issue_date};${inv.due_date};${inv.total_with_vat};${inv.currency};${inv.status}`
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
        <h2 className="text-lg font-semibold text-foreground mb-2">Vitajte v Peppol Faktura</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Zacnite pridanim firmy, za ktoru budete vystavovat faktury.
        </p>
        <Link
          href="/suppliers/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Pridat dodavatela
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
          placeholder="Hladat fakturu alebo odberatela..."
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
            {invoices.length === 0 ? 'Zatial ziadne faktury' : 'Ziadne vysledky'}
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
                {monthInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
                  >
                    {/* Left: invoice info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium font-mono text-foreground">
                          {inv.invoice_number}
                        </span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{inv.buyer_name}</p>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{fmt(inv.total_with_vat)}</p>
                        <p className="text-xs text-muted-foreground">{inv.currency}</p>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-0.5">
                        {(inv.status === 'valid' || inv.status === 'sent') && !inv.invoice_number.startsWith('CN-') && (
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
                ))}
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
                'Nacitat dalsie'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
