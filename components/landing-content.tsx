'use client'

import { FileText, Sun, Moon, Loader2 } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

declare global {
  interface Window {
    AppleID: {
      auth: {
        init: (config: Record<string, unknown>) => void
        signIn: () => Promise<{
          authorization: { id_token: string; code: string }
          user?: { name?: { firstName?: string; lastName?: string }; email?: string }
        }>
      }
    }
  }
}

export function LandingContent() {
  const { theme, toggleTheme } = useTheme()
  const [appleLoading, setAppleLoading] = useState(false)
  const [appleReady, setAppleReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Get the site URL for Apple redirect URI
  const siteUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin)
    : ''

  function initApple() {
    if (typeof window !== 'undefined' && window.AppleID) {
      window.AppleID.auth.init({
        clientId: 'sk.zrobefakturu.web',
        scope: 'name email',
        redirectURI: `${siteUrl}/auth/callback`,
        usePopup: true,
      })
      setAppleReady(true)
    }
  }

  useEffect(() => {
    // If Apple JS SDK already loaded
    if (typeof window !== 'undefined' && window.AppleID) {
      initApple()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAppleSignIn() {
    if (!window.AppleID) return
    setAppleLoading(true)
    try {
      const response = await window.AppleID.auth.signIn()
      const idToken = response.authorization.id_token

      // Use signInWithIdToken -- Supabase only validates the token,
      // no code exchange needed (avoids "Unable to exchange external code" error)
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
      })

      if (error) throw error

      // Store user name if provided (Apple only returns name on first auth)
      if (response.user?.name) {
        const { firstName, lastName } = response.user.name
        const fullName = [firstName, lastName].filter(Boolean).join(' ')
        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          })
        }
      }

      // Check if user has a supplier profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (!suppliers || suppliers.length === 0) {
          router.push('/suppliers/new')
          return
        }
      }
      router.push('/dashboard')
    } catch (err) {
      const error = err as { error?: string; message?: string }
      // Don't show error if user just closed the popup
      if (error.error === 'popup_closed_by_user') {
        setAppleLoading(false)
        return
      }
      console.error('Apple sign-in error:', error)
      alert('Prihlasenie cez Apple zlyhalo. Skuste to znova.')
    } finally {
      setAppleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Apple JS SDK */}
      <Script
        src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
        onLoad={initApple}
      />

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
          <span className="text-2xl font-bold text-foreground">{'Zrobenie e-faktúry'}</span>
        </div>
        <p className="text-lg text-muted-foreground mb-8">pre drobečkov</p>

        {/* Google Sign In - server-side route to avoid localhost redirect */}
        <a
          href="/auth/sign-in"
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-foreground text-background text-lg font-medium hover:opacity-90 transition-opacity"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {'Prihlasit sa cez Google'}
        </a>

        {/* Apple Sign In - Popup + ID Token flow (Method B) */}
        <button
          onClick={handleAppleSignIn}
          disabled={appleLoading || !appleReady}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border border-border bg-card text-foreground text-lg font-medium hover:opacity-90 transition-opacity mt-3 disabled:opacity-50"
        >
          {appleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          {appleLoading ? 'Prihlasovanie...' : 'Prihlásiť sa cez Apple'}
        </button>

        <p className="text-sm text-muted-foreground mt-6">
          {'Prihlasenim suhlasite s podmienkami pouzivania'}
        </p>
      </div>
    </div>
  )
}
