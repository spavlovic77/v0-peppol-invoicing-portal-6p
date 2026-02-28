import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET() {
  const supabase = await createClient()
  const headersList = await headers()

  // Get the real origin from the request headers (not window.location which is localhost in iframe)
  const host = headersList.get('host') || ''
  const proto = headersList.get('x-forwarded-proto') || 'https'
  const origin = `${proto}://${host}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}?error=auth`)
  }

  return NextResponse.redirect(data.url)
}
