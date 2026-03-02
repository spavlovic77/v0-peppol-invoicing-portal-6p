'use client'

import { SupplierProvider } from '@/lib/supplier-context'
import { AiPanelProvider } from '@/lib/ai-context'
import { Navbar } from '@/components/navbar'
import { AiAssistantPanel } from '@/components/ai-assistant-panel'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <div className="flex flex-col flex-1 min-h-0 h-full">
        <Navbar />
        <AiPanelProvider>
          <div className="flex flex-1 min-h-0">
            <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 md:pb-6 overflow-y-auto">
              {children}
            </main>
            <AiAssistantPanel />
          </div>
        </AiPanelProvider>
      </div>
    </SupplierProvider>
  )
}
