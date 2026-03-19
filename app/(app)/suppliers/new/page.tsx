'use client'

import { SupplierForm } from '@/components/supplier-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewSupplierPage() {
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
        <h1 className="text-2xl font-bold text-foreground">Nový dodávateľ</h1>
        <p className="text-muted-foreground mt-1">
          Pridajte novú firmu, za ktorú budete vystavovať faktúry
        </p>
      </div>
      <SupplierForm />
    </div>
  )
}
