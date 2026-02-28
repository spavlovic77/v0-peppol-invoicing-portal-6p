import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ION_AP_BASE = 'https://test.ion-ap.net'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const participantId = searchParams.get('participant_id')
  const supplierId = searchParams.get('supplier_id')

  if (!participantId || !supplierId) {
    return NextResponse.json(
      { error: 'participant_id and supplier_id are required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch supplier's AP API key
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('ap_api_key')
    .eq('id', supplierId)
    .eq('user_id', user.id)
    .single()

  if (!supplier?.ap_api_key) {
    return NextResponse.json(
      { error: 'AP API kluc nie je nastaveny pre tohto dodavatela' },
      { status: 400 }
    )
  }

  try {
    const encoded = encodeURIComponent(participantId)
    const res = await fetch(`${ION_AP_BASE}/api/v2/discover/${encoded}?log_level=NOTSET`, {
      headers: {
        'Authorization': `Token ${supplier.ap_api_key}`,
        'Accept': 'application/json',
      },
    })

    if (res.status === 200) {
      const data = await res.json()
      return NextResponse.json({ found: true, data })
    } else if (res.status === 404) {
      return NextResponse.json({ found: false })
    } else {
      const text = await res.text()
      console.error('[v0] ION AP discover error:', res.status, text)
      return NextResponse.json(
        { error: `ION AP error: ${res.status}` },
        { status: res.status }
      )
    }
  } catch (err) {
    console.error('[v0] ION AP discover fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to connect to ION AP' },
      { status: 502 }
    )
  }
}
