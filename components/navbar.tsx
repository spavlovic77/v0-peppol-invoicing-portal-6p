'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileText, LayoutDashboard, User, Plus, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Prehad', icon: LayoutDashboard },
  { href: '/invoices/new', label: 'Nova faktura', icon: Plus },
  { href: '/profile', label: 'Profil', icon: User },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav className="glass-card-heavy sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground hidden sm:block">Peppol Faktura</span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                pathname.startsWith(href)
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:block">{label}</span>
            </Link>
          ))}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:block">Odhlasit</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
