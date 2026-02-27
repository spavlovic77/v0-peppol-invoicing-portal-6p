'use client'

import { createClient } from '@/lib/supabase/client'
import { FileText, Zap, Shield, ArrowRight } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Peppol Faktura</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">
            Elektronicka fakturacia podla Peppol BIS 3.0
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Vytvarajte platne e-faktury s AI asistenciou a automatickou validaciou
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Presmerovanie...' : 'Prihlasit sa cez Google'}
          </button>

          <div className="mt-6 space-y-3">
            {[
              { icon: Zap, text: 'AI generovanie XML faktur' },
              { icon: Shield, text: 'Validacia EN16931 + Peppol schematronov' },
              { icon: ArrowRight, text: 'Export do PDF a XML' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Prihlasenim suhlasite s podmienkami pouzivania
        </p>
      </div>
    </div>
  )
}
