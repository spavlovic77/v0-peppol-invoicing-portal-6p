'use client'

import { FileText, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Theme toggle - top right */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 p-3 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-colors"
        aria-label="Prepnut temu"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-sm text-center">
        {/* Logo + Name */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-bold text-foreground">Zrob e-fakturu</span>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-foreground text-background text-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Prihlasit sa cez Google
        </a>

        <p className="text-sm text-muted-foreground mt-6">
          Prihlasenim suhlasite s podmienkami pouzivania
        </p>
      </div>
    </div>
  )
}
