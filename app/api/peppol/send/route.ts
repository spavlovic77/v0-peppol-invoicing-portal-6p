import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ION_AP_BASE = 'https://test.ion-ap.net'

export async function POST(request: Request) {
  const { invoiceId } = await request.json()
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the invoice with its XML
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, xml_content, status, supplier_id, peppol_send_status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Faktura nenajdena' }, { status: 404 })
  }
  if (!invoice.xml_content) {
    return NextResponse.json({ error: 'Faktura nema vygenerovane XML' }, { status: 400 })
  }
  if (invoice.status === 'invalid') {
    return NextResponse.json({ error: 'Faktura obsahuje validacne chyby' }, { status: 400 })
  }
  if (invoice.peppol_send_status === 'sent' || invoice.peppol_send_status === 'delivered') {
    return NextResponse.json({ error: 'Faktura uz bola odoslana' }, { status: 400 })
  }

  // Fetch supplier's AP API key
  if (!invoice.supplier_id) {
    return NextResponse.json({ error: 'Faktura nema priradeneho dodavatela' }, { status: 400 })
  }
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('ap_api_key')
    .eq('id', invoice.supplier_id)
    .eq('user_id', user.id)
    .single()

  if (!supplier?.ap_api_key) {
    return NextResponse.json({ error: 'AP API kluc nie je nastaveny' }, { status: 400 })
  }

  try {
    // Send document to ION AP
    const res = await fetch(`${ION_AP_BASE}/api/v2/send-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${supplier.ap_api_key}`,
        'Content-Type': 'application/xml',
      },
      body: invoice.xml_content,
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[v0] ION AP send error:', res.status, text)
      return NextResponse.json(
        { error: `ION AP chyba: ${res.status} - ${text.substring(0, 200)}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    // The response should contain a transaction ID
    const transactionId = data.id || data.transaction_id || data.uuid || null

    // Update invoice with send status
    await supabase
      .from('invoices')
      .update({
        peppol_send_status: 'sent',
        peppol_transaction_id: transactionId,
        peppol_sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return NextResponse.json({
      success: true,
      transactionId,
      message: 'Faktura bola odoslana cez Peppol',
    })
  } catch (err) {
    console.error('[v0] ION AP send fetch error:', err)
    return NextResponse.json(
      { error: 'Nepodarilo sa pripojit k ION AP' },
      { status: 502 }
    )
  }
}
