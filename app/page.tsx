import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingContent } from '@/components/landing-content'

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const code = params.code

  // If Supabase redirected here with an auth code, exchange it and redirect
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
          redirect('/suppliers/new')
        }
      }
      redirect('/dashboard')
    }
  }

  // Check if already logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  return <LandingContent />
}
