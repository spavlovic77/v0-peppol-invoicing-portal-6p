import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public endpoint - no auth required
// Uses service role to bypass RLS for aggregate count
export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Error fetching invoice count:', error)
      return NextResponse.json({ count: 0 }, { status: 200 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    console.error('Stats API error:', err)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
