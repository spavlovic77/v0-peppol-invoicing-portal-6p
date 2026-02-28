import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

function getOrigin(headersList: Headers): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const headersList = await headers()
  const origin = getOrigin(headersList)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if user has a supplier profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (!suppliers || suppliers.length === 0) {
          return NextResponse.redirect(`${origin}/suppliers/new`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}

// POST: Apple sends auth response via form_post
export async function POST(request: Request) {
  const headersList = await headers()
  const origin = getOrigin(headersList)

  try {
    const formData = await request.formData()
    const code = formData.get('code') as string | null
    const idToken = formData.get('id_token') as string | null
    const error = formData.get('error') as string | null

    if (error) {
      return NextResponse.redirect(`${origin}/auth/error?error=${error}`)
    }

    if (code) {
      const supabase = await createClient()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (!exchangeError) {
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }

    // If we got an id_token but no code exchange, redirect to home
    // The client-side will handle signInWithIdToken
    if (idToken) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  } catch {
    // Fall through to error
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
