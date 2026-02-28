import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

function getSiteUrl(headersList: Headers): string {
  // 1. Explicit env var takes highest priority
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // 2. Vercel system env var (automatically set on deployments)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // 3. Derive from request headers 
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || ''
  const proto = headersList.get('x-forwarded-proto') || 'https'
  
  // Never use localhost -- if we detect it, don't set a redirectTo at all
  // and let Supabase use its configured Site URL
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return ''
  }

  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const headersList = await headers()
  const siteUrl = getSiteUrl(headersList)

  // Support provider selection via query param (?provider=apple)
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider') === 'apple' ? 'apple' : 'google'

  const options: Record<string, unknown> = {}
  if (siteUrl) {
    options.redirectTo = `${siteUrl}/auth/callback`
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options,
  })

  if (error || !data.url) {
    const fallback = siteUrl || 'https://localhost:3000'
    return NextResponse.redirect(`${fallback}?error=auth`)
  }

  return NextResponse.redirect(data.url)
}
