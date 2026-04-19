import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSendTransaction, IonApError } from '@/lib/ion-ap'

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

  try {
    const data = await getSendTransaction(invoice.peppol_transaction_id)
    const apState = ((data.state || data.status || '') as string).toUpperCase()
    let newStatus = invoice.peppol_send_status

    if (
      apState === 'SENT' ||
      apState === 'DELIVERED' ||
      apState === 'ACCEPTED' ||
      apState === 'COMPLETED' ||
      apState === 'DONE'
    ) {
      newStatus = 'delivered'
    } else if (
      apState === 'FAILED' ||
      apState === 'REJECTED' ||
      apState === 'ERROR' ||
      apState === 'INVALID'
    ) {
      newStatus = 'failed'
    } else if (
      apState === 'PENDING' ||
      apState === 'PROCESSING' ||
      apState === 'QUEUED' ||
      apState === 'SENDING' ||
      apState === 'DEFERRED' ||
      apState === 'IN_PROGRESS'
    ) {
      newStatus = 'sent'
    }

    if (newStatus !== invoice.peppol_send_status) {
      await supabase
        .from('invoices')
        .update({ peppol_send_status: newStatus })
        .eq('id', invoiceId)
    }

    return NextResponse.json({ status: newStatus, raw: data })
  } catch (err) {
    if (err instanceof IonApError) {
      console.error('[peppol/status] ion-AP error:', err.status, err.body)
      return NextResponse.json({ status: invoice.peppol_send_status || 'unknown' })
    }
    console.error('[peppol/status] fetch error:', err)
    return NextResponse.json({ status: invoice.peppol_send_status || 'unknown' })
  }
}
