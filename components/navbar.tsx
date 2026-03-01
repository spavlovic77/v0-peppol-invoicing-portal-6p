'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { useTheme } from '@/lib/theme-provider'
import {
  FileText, Plus, LogOut, Building2,
  ChevronDown, Contact, Sun, Moon, ReceiptText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const tabs = [
  { href: '/dashboard', label: 'Faktury', icon: ReceiptText },
  { href: '/invoices/new', label: 'Nova', icon: Plus },
  { href: '/suppliers', label: 'Firmy', icon: Building2 },
  { href: '/buyers', label: 'Odberatelia', icon: Contact },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { suppliers, activeSupplier, setActiveSupplier } = useActiveSupplier()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUser, setShowUser] = useState(false)
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
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
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
                  {activeSupplier?.company_name ?? 'Vybrat dodavatela'}
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
                          <div className="text-xs text-muted-foreground">{'ICO: '}{s.ico}</div>
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
                      Pridat dodavatela
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
              <span className="font-semibold text-foreground text-sm">Zrob e-fakturu</span>
            </Link>
          )}

          {/* Right: theme + user */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Prepnut temu"
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
                      Odhlasit sa
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
      </nav>

      {/* ───── Desktop horizontal nav (inside top bar on md+) ───── */}
      <nav className="hidden md:block glass-card border-b border-border">
        <div className="max-w-7xl mx-auto px-3 flex items-center gap-1 h-10">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href)
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
    </>
  )
}
