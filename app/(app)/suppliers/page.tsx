'use client'

import Link from 'next/link'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { Building2, Plus, Pencil, CreditCard, Loader2 } from 'lucide-react'

export default function SuppliersPage() {
  const { suppliers, activeSupplier, setActiveSupplier, loading } = useActiveSupplier()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dodavatelia</h1>
          <p className="text-muted-foreground mt-1">
            Spravujte firmy, za ktore vystavujete faktury
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
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
                className={isActive ? 'ring-1 ring-primary/40' : ''}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-primary/20' : 'bg-secondary'}`}>
                      <Building2 className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{s.company_name}</h3>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                            Aktivny
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{'ICO: '}{s.ico}</span>
                        {s.dic && <span>{'DIC: '}{s.dic}</span>}
                        {s.ic_dph && <span>{'IC DPH: '}{s.ic_dph}</span>}
                      </div>
                      {(s.street || s.city) && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {[s.street, s.postal_code, s.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {s.iban && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <CreditCard className="w-3.5 h-3.5" />
                          {s.iban}
                        </div>
                      )}
                      {s.dic && (
                        <div className="text-xs font-mono text-primary/70 mt-1.5">
                          Peppol ID: 0245:{s.dic}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => setActiveSupplier(s)}
                        className="px-3 py-1.5 rounded-lg text-sm border border-glass-border text-foreground hover:bg-secondary transition-colors"
                      >
                        Nastavit ako aktivny
                      </button>
                    )}
                    <Link
                      href={`/suppliers/${s.id}/edit`}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
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
