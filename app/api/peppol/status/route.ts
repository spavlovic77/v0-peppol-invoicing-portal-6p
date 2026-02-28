import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ION_AP_BASE = 'https://test.ion-ap.net'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId') || searchParams.get('invoice_id')

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, supplier_id, peppol_transaction_id, peppol_send_status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Faktura nenajdena' }, { status: 404 })
  }
  if (!invoice.peppol_transaction_id) {
    return NextResponse.json({ status: invoice.peppol_send_status || 'not_sent' })
  }

  // Fetch supplier's AP API key
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('ap_api_key')
    .eq('id', invoice.supplier_id)
    .eq('user_id', user.id)
    .single()

  if (!supplier?.ap_api_key) {
    return NextResponse.json({ status: invoice.peppol_send_status || 'unknown' })
  }

  try {
    const res = await fetch(
      `${ION_AP_BASE}/api/v2/send-transactions/${invoice.peppol_transaction_id}`,
      {
        headers: {
          'Authorization': `Token ${supplier.ap_api_key}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ status: invoice.peppol_send_status || 'unknown' })
    }

    const data = await res.json()
    // Map ION AP state to our internal status
    // ION AP uses "state" field with values like: SENT, FAILED, PENDING, etc.
    // "SENT" = final success (document transmitted to recipient AP)
    const apState = (data.state || data.status || '').toUpperCase()
    let newStatus = invoice.peppol_send_status

    if (apState === 'SENT' || apState === 'DELIVERED' || apState === 'ACCEPTED' || apState === 'COMPLETED' || apState === 'DONE') {
      newStatus = 'delivered'
    } else if (apState === 'FAILED' || apState === 'REJECTED' || apState === 'ERROR' || apState === 'INVALID') {
      newStatus = 'failed'
    } else if (apState === 'PENDING' || apState === 'PROCESSING' || apState === 'QUEUED' || apState === 'IN_PROGRESS') {
      newStatus = 'sent' // still in transit
    }

    // Update status if changed
    if (newStatus !== invoice.peppol_send_status) {
      await supabase
        .from('invoices')
        .update({ peppol_send_status: newStatus })
        .eq('id', invoiceId)
    }

    return NextResponse.json({
      status: newStatus,
      raw: data,
    })
  } catch (err) {
    console.error('[v0] ION AP status poll error:', err)
    return NextResponse.json({ status: invoice.peppol_send_status || 'unknown' })
  }
}
