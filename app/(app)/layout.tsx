import { Navbar } from '@/components/navbar'
import { SupplierProvider } from '@/lib/supplier-context'
import { AiPanelProvider } from '@/lib/ai-context'
import dynamic from 'next/dynamic'

const AiAssistantPanel = dynamic(
  () => import('@/components/ai-assistant-panel').then((m) => m.AiAssistantPanel),
  { ssr: false }
)

// All app pages require auth / Supabase — never statically prerender
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <AiPanelProvider>
        <Navbar />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 md:pb-6 overflow-y-auto">{children}</main>
          <AiAssistantPanel />
        </div>
      </AiPanelProvider>
    </SupplierProvider>
  )
}
