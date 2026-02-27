import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const _inter = Inter({ subsets: ['latin', 'latin-ext'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Peppol Faktura - E-fakturacny portal',
  description: 'Vytvarajte platne Peppol BIS 3.0 elektronicke faktury s AI asistenciou. Validacia podla EN16931 a Peppol schematronov.',
}

export const viewport: Viewport = {
  themeColor: '#0f0b1a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk">
      <body className="font-sans antialiased min-h-screen">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[#0f0b1a]" />
          <div
            className="absolute inset-0 opacity-30 animate-gradient"
            style={{
              background: 'linear-gradient(135deg, #1e1145 0%, #0f0b1a 25%, #1a0a2e 50%, #0f0b1a 75%, #12082a 100%)',
              backgroundSize: '400% 400%',
            }}
          />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        </div>
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgba(26, 21, 40, 0.9)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f0eef5',
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
