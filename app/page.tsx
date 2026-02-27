import Link from 'next/link'
import { FileText, Zap, Shield, Download, ArrowRight } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'AI generovanie',
    desc: 'Umela inteligencia vytvori platnu Peppol BIS 3.0 fakturu podla vasich udajov',
  },
  {
    icon: Shield,
    title: '3-fazova validacia',
    desc: 'Kontrola struktury, EN16931 pravidiel a Peppol schematronov',
  },
  {
    icon: Download,
    title: 'XML + PDF export',
    desc: 'Stiahnite si fakturu vo formate UBL XML aj ako profesionalny PDF',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card-heavy">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Peppol Faktura</span>
          </div>
          <Link
            href="/auth/login"
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Prihlasit sa
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs text-muted-foreground mb-8">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Peppol BIS Billing 3.0
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
          Elektronicka fakturacia pre{' '}
          <span className="text-primary">slovenske firmy</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed text-pretty">
          Vytvarajte platne Peppol e-faktury za minuty. AI vam pomoze s generovanim UBL XML,
          automaticky validuje podla europskych standardov a schematronov.
        </p>

        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-medium text-lg hover:bg-primary/90 transition-colors"
        >
          Zacat fakturovat
          <ArrowRight className="w-5 h-5" />
        </Link>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-24">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-2xl p-6 text-left">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-24 glass-card rounded-2xl p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Peppol BIS 3.0', value: 'Certifikovane' },
              { label: 'EN16931', value: 'Kompletne' },
              { label: 'XSD + Schematron', value: '3-fazova validacia' },
              { label: 'Peppol ID', value: '0245:DIC' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-sm font-semibold text-primary">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="glass-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          Peppol Faktura &middot; Elektronicka fakturacia podla Peppol BIS Billing 3.0
        </div>
      </footer>
    </div>
  )
}
