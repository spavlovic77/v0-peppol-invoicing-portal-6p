import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'

import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme-provider'
import { WebsiteStructuredData, FAQStructuredData, OrganizationStructuredData } from '@/components/seo/structured-data'
import './globals.css'

const _inter = Inter({ subsets: ['latin', 'latin-ext'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://zrobefakturu.sk'),
  title: {
    default: 'zrobefakturu.sk - Elektronická fakturácia na Slovensku',
    template: '%s | zrobefakturu.sk',
  },
  description: 'Vytvárajte elektronické faktúry',
  keywords: [
    'elektronická faktúra',
    'e-faktúra',
    'Peppol',
    'Peppol BIS 3.0',
    'EN16931',
    'UBL faktúra',
    'fakturácia online',
    'fakturačný systém',
    'faktúry zadarmo',
    'slovensko faktúra',
    'dobropis',
    'credit note',
    'B2B faktura',
    'XML faktura',
    'efaktura slovensko',
  ],
  authors: [{ name: 'zrobefakturu.sk' }],
  creator: 'zrobefakturu.sk',
  publisher: 'zrobefakturu.sk',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: 'https://zrobefakturu.sk',
    siteName: 'zrobefakturu.sk',
    title: 'zrobefakturu.sk - Elektronická fakturácia na Slovensku',
    description: 'Vytvárajte elektronické faktúry.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zrobefakturu.sk - Elektronická fakturácia na Slovensku',
    description: 'Vytvárajte elektronické faktúry.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: 'https://zrobefakturu.sk',
  },
  category: 'business',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <WebsiteStructuredData />
        <FAQStructuredData />
        <OrganizationStructuredData />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased h-dvh flex flex-col overflow-hidden bg-background text-foreground">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              color: 'var(--popover-foreground)',
            },
          }}
        />
      </body>
    </html>
  )
}
