import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function AuthError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Chyba prihlasenia</h1>
        <p className="text-muted-foreground mb-6">
          Pri prihlasovani nastala chyba. Skuste to prosim znova.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Spat na prihlasenie
        </Link>
      </div>
    </div>
  )
}
