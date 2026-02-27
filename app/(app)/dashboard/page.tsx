'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Plus, FileText, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { GlassCard } from '@/components/glass-card'

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

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Check profile
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    setHasProfile(!!profile)

    // Load invoices
    const { data: invs } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setInvoices(invs || [])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = invoices.filter(
    (inv) =>
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.buyer_name.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: invoices.length,
    valid: invoices.filter((i) => i.status === 'valid').length,
    draft: invoices.filter((i) => i.status === 'draft').length,
    totalAmount: invoices.reduce((s, i) => s + (i.total_with_vat || 0), 0),
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Profile Warning */}
      {!hasProfile && (
        <GlassCard heavy>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Dokoncite registraciu</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Pre vystavovanie faktur je potrebne vyplnit firemny profil a platobne udaje.
              </p>
            </div>
            <Link
              href="/profile"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Vyplnit profil
            </Link>
          </div>
        </GlassCard>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prehlad faktur</h1>
          <p className="text-muted-foreground mt-1">Spravujte svoje Peppol e-faktury</p>
        </div>
        <Link
          href="/invoices/new"
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors ${
            !hasProfile ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <Plus className="w-4 h-4" />
          Nova faktura
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Celkom faktur</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Validne</div>
          <div className="text-2xl font-bold text-success">{stats.valid}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Koncepty</div>
          <div className="text-2xl font-bold text-warning">{stats.draft}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-1">Celkova suma</div>
          <div className="text-2xl font-bold text-primary">{fmt(stats.totalAmount)} EUR</div>
        </GlassCard>
      </div>

      {/* Search + List */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Hladat podla cisla faktury alebo odberatela..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {invoices.length === 0 ? 'Zatial nemAte ziadne faktury' : 'Ziadne vysledky hladania'}
            </p>
            {invoices.length === 0 && hasProfile && (
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors mt-4"
              >
                <Plus className="w-4 h-4" />
                Vytvorit prvu fakturu
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-3 font-medium">Cislo</th>
                  <th className="pb-3 font-medium">Odberatel</th>
                  <th className="pb-3 font-medium">Datum</th>
                  <th className="pb-3 font-medium text-right">Suma</th>
                  <th className="pb-3 font-medium text-center">Stav</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="border-t border-border cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-foreground font-medium font-mono text-xs">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="py-3 text-foreground">{inv.buyer_name}</td>
                    <td className="py-3 text-muted-foreground">{inv.issue_date}</td>
                    <td className="py-3 text-right text-foreground font-medium">
                      {fmt(inv.total_with_vat)} {inv.currency}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        {inv.status === 'valid' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Validna
                          </span>
                        ) : inv.status === 'invalid' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium">
                            <XCircle className="w-3 h-3" />
                            Chyba
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            Koncept
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
