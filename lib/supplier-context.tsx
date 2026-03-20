'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Supplier {
  id: string
  user_id: string
  ico: string
  dic: string | null
  ic_dph: string | null
  company_name: string
  street: string | null
  city: string | null
  postal_code: string | null
  country_code: string
  bank_name: string | null
  iban: string | null
  swift: string | null
  email: string | null
  phone: string | null
  web: string | null
  registration_court: string | null
  registration_number: string | null
  is_vat_payer: boolean
  is_billing_entity: boolean
}

interface SupplierContextType {
  suppliers: Supplier[]
  activeSupplier: Supplier | null
  setActiveSupplier: (supplier: Supplier) => void
  refreshSuppliers: () => Promise<void>
  loading: boolean
}

const SupplierContext = createContext<SupplierContextType>({
  suppliers: [],
  activeSupplier: null,
  setActiveSupplier: () => {},
  refreshSuppliers: async () => {},
  loading: true,
})

export function useActiveSupplier() {
  return useContext(SupplierContext)
}

export function SupplierProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [activeSupplier, setActiveSupplierState] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refreshSuppliers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[v0] refreshSuppliers - user:', user?.id, 'provider:', user?.app_metadata?.provider)
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    console.log('[v0] refreshSuppliers - query result:', { count: data?.length, error, userId: user.id })
    
    const list = (data ?? []) as Supplier[]
    setSuppliers(list)

    if (list.length > 0) {
      // Restore from localStorage or pick first
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_supplier_id') : null
      const saved = savedId ? list.find((s) => s.id === savedId) : null
      setActiveSupplierState(saved ?? list[0])
    } else {
      setActiveSupplierState(null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refreshSuppliers()
  }, [refreshSuppliers])

  const setActiveSupplier = (supplier: Supplier) => {
    setActiveSupplierState(supplier)
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_supplier_id', supplier.id)
    }
  }

  return (
    <SupplierContext.Provider value={{ suppliers, activeSupplier, setActiveSupplier, refreshSuppliers, loading }}>
      {children}
    </SupplierContext.Provider>
  )
}
