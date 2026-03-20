'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { useTheme } from '@/lib/theme-provider'
import {
  FileText, Plus, LogOut, Building2,
  ChevronDown, Contact, Sun, Moon, ReceiptText, X, Check,
  ArrowLeftRight, RefreshCw, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import type { Supplier } from '@/lib/supplier-context'

const tabs = [
  { href: '/dashboard', label: 'Faktúry', icon: ReceiptText },
  { href: '/invoices/new', label: 'Nová', icon: Plus },
  { href: '/suppliers', label: 'Firmy', icon: Building2 },
  { href: '/buyers', label: 'Odberatelia', icon: Contact },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { suppliers, activeSupplier, setActiveSupplier } = useActiveSupplier()
  const [aiOpen, setAiOpen] = useState(false)

  // Listen for AI panel state broadcasts (from AiAssistantPanel)
  useEffect(() => {
    const handler = (e: CustomEvent) => setAiOpen(!!e.detail?.open)
    window.addEventListener('ai-panel-state' as string, handler as EventListener)
    return () => window.removeEventListener('ai-panel-state' as string, handler as EventListener)
  }, [])

  function toggleAi() {
    window.dispatchEvent(new CustomEvent('ai-panel-toggle'))
  }
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false)
  const [modalSupplier, setModalSupplier] = useState<Supplier | null>(null)
  const [showNewDropdown, setShowNewDropdown] = useState(false)
  const [pendingMode, setPendingMode] = useState<string>('standard')
  const newDropdownRef = useRef<HTMLDivElement>(null)
  const mobileNewDropdownRef = useRef<HTMLDivElement>(null)
  const modalJustOpenedRef = useRef(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [supabase])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false)
      
      const desktopContains = newDropdownRef.current?.contains(e.target as Node)
      const mobileContains = mobileNewDropdownRef.current?.contains(e.target as Node)
      
      if (!desktopContains && !mobileContains) {
        setShowNewDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const invoiceModes = [
    { mode: 'standard', label: 'Faktúra', icon: FileText, desc: 'Štandardná faktúra (380)' },
    { mode: 'selfbilling', label: 'Samofakturácia', icon: ArrowLeftRight, desc: 'Odberateľ vystavuje faktúru (389)' },
    { mode: 'reversecharge', label: 'Prenesenie DPH', icon: RefreshCw, desc: 'Reverse charge — §69 ods. 12' },
  ]

  function handleNewInvoiceClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowNewDropdown((prev) => !prev)
  }

  function handleSelectMode(mode: string, e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    
    setShowNewDropdown(false)
    setPendingMode(mode)
    if (suppliers.length <= 1) {
      router.push(`/invoices/new?mode=${mode}`)
      return
    }
    setModalSupplier(activeSupplier)
    // Set flag to prevent immediate backdrop click from closing the modal on mobile
    modalJustOpenedRef.current = true
    setShowNewInvoiceModal(true)
    // Reset flag after a short delay (enough for touch events to finish)
    setTimeout(() => {
      modalJustOpenedRef.current = false
    }, 300)
  }

  function handleModalConfirm() {
    if (modalSupplier && modalSupplier.id !== activeSupplier?.id) {
      setActiveSupplier(modalSupplier)
    }
    setShowNewInvoiceModal(false)
    router.push(`/invoices/new?mode=${pendingMode}`)
  }

  const isTabActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ───── Slim Top Bar ───── */}
      <header className="glass-card-heavy sticky top-0 z-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-3 flex items-center justify-between h-12">
          {/* Left: supplier name (prominent) */}
          {suppliers.length > 0 ? (
            <div className="relative flex-1 min-w-0" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 min-w-0 max-w-full"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">
                  {activeSupplier?.company_name ?? 'Vybrať dodávateľa'}
                </span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', showDropdown && 'rotate-180')} />
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-popover text-popover-foreground rounded-xl overflow-hidden shadow-xl border border-border z-50">
                  <div className="p-1.5">
                    {suppliers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveSupplier(s); setShowDropdown(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5',
                          s.id === activeSupplier?.id
                            ? 'bg-primary/15 text-primary'
                            : 'text-foreground hover:bg-secondary'
                        )}
                      >
                        <Building2 className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.company_name}</div>
                          <div className="text-xs text-muted-foreground">{'IČO: '}{s.ico}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border p-1.5">
                    <Link
                      href="/suppliers/new"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Pridať dodávateľa
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-semibold text-foreground text-sm">Zrob e-faktúru</span>
            </Link>
          )}

          {/* Right: theme + user */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={toggleAi}
              className={cn(
                'p-2 rounded-lg transition-colors relative',
                aiOpen
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
              aria-label="AI Asistent"
              title="Peppol AI Asistent"
            >
              <Sparkles className="w-4 h-4" />
              {aiOpen && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Prepnúť tému"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative" ref={userRef}>
              <button
                onClick={() => setShowUser(!showUser)}
                className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold"
                title={userEmail || 'Pouzivatel'}
              >
                {userEmail ? userEmail[0].toUpperCase() : '?'}
              </button>
              {showUser && (
                <div className="absolute top-full right-0 mt-1.5 w-56 bg-popover text-popover-foreground rounded-xl overflow-hidden shadow-xl border border-border z-50">
                  {userEmail && (
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  )}
                  <div className="p-1.5">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Odhlásiť sa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ───── Bottom Tab Bar (mobile) ───── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-card-heavy border-t border-border pb-safe">
        <div className="flex items-stretch justify-around h-14">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href)
            const isNova = href === '/invoices/new'
            
            if (isNova) {
              return (
                <div key={href} ref={mobileNewDropdownRef} className="flex-1 relative">
                  <button
                    onClick={handleNewInvoiceClick}
                    className={cn(
                      'flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
                      active && 'bg-primary/15'
                    )}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <span className="text-[10px] font-medium leading-none">{label}</span>
                  </button>
                  {/* Mobile dropdown popup */}
                  {showNewDropdown && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-popover text-popover-foreground rounded-xl overflow-hidden shadow-xl border border-border z-50">
                      <div className="p-1.5">
                        {invoiceModes.map(({ mode, label: mLabel, icon: MIcon, desc }) => (
                          <button
                            key={mode}
                            onClick={() => handleSelectMode(mode)}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 text-foreground hover:bg-secondary"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <MIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{mLabel}</div>
                              <div className="text-xs text-muted-foreground">{desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
                  active && 'bg-primary/15'
                )}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}
        </div>

        {/* Mobile mode picker popup */}
        {showNewDropdown && (
          <div className="absolute bottom-full left-0 right-0 mb-2 px-4">
            <div className="bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="p-2">
                        {invoiceModes.map(({ mode, label: mLabel, icon: MIcon, desc }) => (
                          <button
                            key={mode}
                            onClick={(e) => handleSelectMode(mode, e)}
                            onTouchEnd={(e) => { e.preventDefault(); handleSelectMode(mode); }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 text-foreground hover:bg-secondary"
                          >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MIcon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{mLabel}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ───── Desktop horizontal nav (inside top bar on md+) ───── */}
      <nav className="hidden md:block glass-card border-b border-border">
        <div className="max-w-7xl mx-auto px-3 flex items-center gap-1 h-10">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href)
            const isNova = href === '/invoices/new'

            if (isNova) {
              return (
                <div key={href} className="relative" ref={newDropdownRef}>
                  <button
                    onClick={handleNewInvoiceClick}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                      active
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Nová
                    <ChevronDown className={cn('w-3 h-3 transition-transform', showNewDropdown && 'rotate-180')} />
                  </button>
                  {showNewDropdown && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-popover text-popover-foreground rounded-xl overflow-hidden shadow-xl border border-border z-50">
                      <div className="p-1.5">
                        {invoiceModes.map(({ mode, label: mLabel, icon: MIcon, desc }) => (
                          <button
                            key={mode}
                            onClick={(e) => handleSelectMode(mode, e)}
                            onTouchEnd={(e) => { e.preventDefault(); handleSelectMode(mode); }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 text-foreground hover:bg-secondary"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <MIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{mLabel}</div>
                              <div className="text-xs text-muted-foreground">{desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ───── New Invoice Supplier Confirmation Modal ───── */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => {
              if (!modalJustOpenedRef.current) {
                setShowNewInvoiceModal(false)
              }
            }}
          />
          {/* Modal card */}
          <div className="relative w-[90vw] max-w-sm bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold">{pendingMode === 'selfbilling' ? 'Nová samofaktúra' : 'Nová faktúra'}</h3>
              <button
                onClick={() => setShowNewInvoiceModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {pendingMode === 'selfbilling' ? 'Faktúra bude vystavená týmto odberateľom:' : 'Faktúra bude vystavená za firmu:'}
              </p>

              {/* Supplier pick list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {suppliers.map((s) => {
                  const isSelected = s.id === modalSupplier?.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setModalSupplier(s)}
                      className={cn(
                        'w-full text-left px-3.5 py-3 rounded-xl text-sm transition-colors flex items-center gap-3',
                        isSelected
                          ? 'bg-primary/15 border border-primary/30'
                          : 'border border-border hover:bg-secondary'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{s.company_name}</div>
                        <div className="text-xs text-muted-foreground">IČO: {s.ico}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => setShowNewInvoiceModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Zrušiť
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!modalSupplier}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Pokračovať
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
