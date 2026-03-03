'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SupplierForm, type SupplierFormData } from '@/components/supplier-form'
import { GlassCard } from '@/components/glass-card'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function EditSupplierPage() {
  const params = useParams()
  const id = params.id as string
  const [initial, setInitial] = useState<Partial<SupplierFormData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (data) {
        setInitial(data as Partial<SupplierFormData>)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [id, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto">
        <GlassCard className="text-center py-16">
          <h2 className="text-lg font-semibold text-foreground mb-2">Dodavateľ nebol nájdený</h2>
          <Link href="/suppliers" className="text-primary hover:underline">Späť na zoznam</Link>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Späť na dodávateľov
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Upraviť dodávateľa</h1>
        <p className="text-muted-foreground mt-1">
          {initial?.company_name}
        </p>
      </div>
      <SupplierForm initial={initial!} supplierId={id} />
    </div>
  )
}
