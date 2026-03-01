import { Navbar } from '@/components/navbar'
import { SupplierProvider } from '@/lib/supplier-context'

// All app pages require auth / Supabase — never statically prerender
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 md:pb-6">{children}</main>
    </SupplierProvider>
  )
}
