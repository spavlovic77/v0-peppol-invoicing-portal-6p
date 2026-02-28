import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

function getSiteUrl(headersList: Headers): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  const host = headersList.get('x-forwarded-host') || headersList.get('host') || ''
  const proto = headersList.get('x-forwarded-proto') || 'https'

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return ''
  }

  return `${proto}://${host}`
}

export async function GET() {
  const supabase = await createClient()
  const headersList = await headers()
  const siteUrl = getSiteUrl(headersList)

  const options: Record<string, unknown> = {}
  if (siteUrl) {
    options.redirectTo = `${siteUrl}/auth/callback`
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options,
  })

  if (error || !data.url) {
    const fallback = siteUrl || 'https://localhost:3000'
    return NextResponse.redirect(`${fallback}?error=auth`)
  }

  return NextResponse.redirect(data.url)
}
