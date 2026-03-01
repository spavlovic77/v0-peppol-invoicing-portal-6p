'use client'

import Link from 'next/link'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { Building2, Plus, Pencil, CreditCard, Trash2, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SupplierCardSkeleton } from '@/components/skeleton'

export default function SuppliersPage() {
  const { suppliers, activeSupplier, setActiveSupplier, loading, refreshSuppliers } = useActiveSupplier()
  const supabase = createClient()

  async function handleSetBilling(id: string, name: string) {
    // First, unset billing flag on all suppliers for this user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('suppliers')
      .update({ is_billing_entity: false })
      .eq('user_id', user.id)
    // Then set the selected one
    const { error } = await supabase
      .from('suppliers')
      .update({ is_billing_entity: true })
      .eq('id', id)
    if (error) {
      toast.error('Chyba pri nastaveni fakturacneho subjektu: ' + error.message)
    } else {
      toast.success(`${name} je teraz fakturacny subjekt`)
      await refreshSuppliers()
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Naozaj chcete zmazat dodavatela "${name}"? Vsetky faktury tohto dodavatela stratia priradenie.`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) {
      toast.error('Chyba pri mazani: ' + error.message)
    } else {
      toast.success('Dodavatel bol zmazany')
      await refreshSuppliers()
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-40 mb-2" />
            <div className="skeleton h-4 w-64" />
          </div>
          <div className="skeleton h-10 w-44 rounded-xl" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SupplierCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dodavatelia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spravujte firmy, za ktore vystavujete faktury
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Pridat dodavatela
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <GlassCard className="text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Zatial nemas ziadneho dodavatela</h2>
          <p className="text-muted-foreground mb-6">
            Pridaj prvu firmu, za ktoru budes vystavovat faktury
          </p>
          <Link
            href="/suppliers/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Pridat prveho dodavatela
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {suppliers.map((s) => {
            const isActive = s.id === activeSupplier?.id
            return (
              <GlassCard
                key={s.id}
                className={`cursor-pointer transition-all ${
                  isActive
                    ? 'ring-2 ring-primary/50 bg-primary/5'
                    : 'hover:ring-1 hover:ring-border hover:bg-secondary/30'
                }`}
                onClick={() => {
                  if (!isActive) {
                    setActiveSupplier(s)
                    toast.success(`${s.company_name} je teraz aktivny dodavatel`)
                  }
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-primary/20' : 'bg-secondary'}`}>
                      <Building2 className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{s.company_name}</h3>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                            Aktivny
                          </span>
                        )}
                        {s.is_billing_entity && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 shrink-0 flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            Fakturacny subjekt
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                        <span>{'ICO: '}{s.ico}</span>
                        {s.dic && <span>{'DIC: '}{s.dic}</span>}
                      </div>
                      {(s.street || s.city) && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {[s.street, s.postal_code, s.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {s.iban && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <CreditCard className="w-3 h-3" />
                          <span className="truncate">{s.iban}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-12" onClick={(e) => e.stopPropagation()}>
                    {!s.is_billing_entity && (
                      <button
                        onClick={() => handleSetBilling(s.id, s.company_name)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 border border-border transition-colors"
                        title="Nastavit ako fakturacny subjekt"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Fakturovat sem
                      </button>
                    )}
                    <Link
                      href={`/suppliers/${s.id}/edit`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(s.id, s.company_name)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
