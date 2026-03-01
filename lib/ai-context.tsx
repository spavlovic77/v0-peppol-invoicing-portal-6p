'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AiPanelState {
  isOpen: boolean
  togglePanel: () => void
  closePanel: () => void
  openPanel: () => void
  pageContext: Record<string, unknown>
  setPageContext: (ctx: Record<string, unknown>) => void
}

const AiPanelContext = createContext<AiPanelState | null>(null)

export function AiPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pageContext, setPageContextState] = useState<Record<string, unknown>>({})

  const togglePanel = useCallback(() => setIsOpen((v) => !v), [])
  const closePanel = useCallback(() => setIsOpen(false), [])
  const openPanel = useCallback(() => setIsOpen(true), [])
  const setPageContext = useCallback((ctx: Record<string, unknown>) => {
    setPageContextState(ctx)
  }, [])

  return (
    <AiPanelContext.Provider value={{ isOpen, togglePanel, closePanel, openPanel, pageContext, setPageContext }}>
      {children}
    </AiPanelContext.Provider>
  )
}

const defaultState: AiPanelState = {
  isOpen: false,
  togglePanel: () => {},
  closePanel: () => {},
  openPanel: () => {},
  pageContext: {},
  setPageContext: () => {},
}

export function useAiPanel() {
  const ctx = useContext(AiPanelContext)
  return ctx ?? defaultState
}
