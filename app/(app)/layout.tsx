import { AppShell } from '@/components/app-shell'

// All app pages require auth / Supabase — never statically prerender
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
