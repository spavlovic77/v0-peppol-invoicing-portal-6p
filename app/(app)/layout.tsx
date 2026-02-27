import { Navbar } from '@/components/navbar'

// All app pages require auth / Supabase — never statically prerender
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </>
  )
}
