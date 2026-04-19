import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverParticipant, IonApError } from '@/lib/ion-ap'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // Accept both new (identifier) and legacy (participant_id) query names
  const identifier =
    searchParams.get('identifier') || searchParams.get('participant_id')

  if (!identifier) {
    return NextResponse.json(
      { error: 'identifier is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await discoverParticipant(identifier)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof IonApError) {
      console.error('[peppol/discover] ion-AP error:', err.status, err.body)
      return NextResponse.json(
        { error: `ION AP error: ${err.status}` },
        { status: err.status }
      )
    }
    console.error('[peppol/discover] fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to connect to ION AP' },
      { status: 502 }
    )
  }
}
