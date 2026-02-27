'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { useTheme } from '@/lib/theme-provider'
import {
  FileText, LayoutDashboard, Plus, LogOut, Building2,
  ChevronDown, Contact, Sun, Moon, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Prehlad', icon: LayoutDashboard },
  { href: '/invoices/new', label: 'Nova faktura', icon: Plus },
  { href: '/suppliers', label: 'Dodavatelia', icon: Building2 },
  { href: '/buyers', label: 'Odberatelia', icon: Contact },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { suppliers, activeSupplier, setActiveSupplier } = useActiveSupplier()
  const [showDropdown, setShowDropdown] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [supabase])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="glass-card-heavy sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Main bar */}
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground text-base">
              Zrob e-fakturu
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:block">{label}</span>
              </Link>
            ))}
          </div>

          {/* Right side: supplier + theme + user + mobile toggle */}
          <div className="flex items-center gap-2">
            {/* Supplier Switcher - visible from sm+ */}
            {suppliers.length > 0 && (
              <div className="relative hidden sm:block" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm max-w-[180px]"
                >
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate text-foreground text-xs">
                    {activeSupplier?.company_name ?? 'Vybrat...'}
                  </span>
                  <ChevronDown className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', showDropdown && 'rotate-180')} />
                </button>

                {showDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-popover text-popover-foreground rounded-xl overflow-hidden shadow-lg border border-border">
                    <div className="p-1.5">
                      {suppliers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setActiveSupplier(s); setShowDropdown(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                            s.id === activeSupplier?.id
                              ? 'bg-primary/15 text-primary'
                              : 'text-foreground hover:bg-secondary'
                          )}
                        >
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
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
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Prepnut temu"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Desktop user */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border">
              {userEmail && (
                <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                  {userEmail}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Odhlasit sa"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border pb-4 pt-3 space-y-1">
            {/* Supplier switcher on mobile */}
            {suppliers.length > 0 && (
              <div className="px-1 pb-3 mb-2 border-b border-border">
                <div className="text-xs text-muted-foreground mb-2 px-3">Aktivny dodavatel</div>
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSupplier(s); setMobileOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2',
                      s.id === activeSupplier?.id
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-foreground hover:bg-secondary'
                    )}
                  >
                    <Building2 className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate">{s.company_name}</div>
                      <div className="text-xs text-muted-foreground">{'ICO: '}{s.ico}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Nav links */}
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}

            {/* User info + sign out */}
            <div className="mt-3 pt-3 border-t border-border px-3 flex items-center justify-between">
              {userEmail && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {userEmail}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Odhlasit
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
