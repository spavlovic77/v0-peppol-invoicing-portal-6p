import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateInvoiceXml } from '@/lib/real-validation'
import { buildPeppolInvoice } from '@/lib/invoice-builder'
import { sendDocument, IonApError } from '@/lib/ion-ap'

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

  if (!invoice.supplier_id) {
    return NextResponse.json({ error: 'Faktura nema priradeneho dodavatela' }, { status: 400 })
  }
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('peppol_organization_id')
    .eq('id', invoice.supplier_id)
    .eq('user_id', user.id)
    .single()

  if (!supplier?.peppol_organization_id) {
    return NextResponse.json(
      { error: 'Dodavatel nie je registrovany v Peppol sieti' },
      { status: 400 }
    )
  }

  // Pre-send validation gate -- re-validate before sending
  try {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number')

    const { data: fullInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    let supplierProfile = null
    if (fullInvoice?.supplier_id) {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', fullInvoice.supplier_id)
        .single()
      supplierProfile = data
    }

    if (fullInvoice && items && supplierProfile) {
      const peppolInvoice = buildPeppolInvoice(fullInvoice, items, supplierProfile)
      const validationResults = await validateInvoiceXml(invoice.xml_content, peppolInvoice)
      const hasErrors = validationResults.some((phase) => !phase.passed)

      if (hasErrors) {
        await supabase
          .from('invoices')
          .update({ validation_errors: validationResults, status: 'invalid' })
          .eq('id', invoiceId)

        const failedPhases = validationResults.filter((p) => !p.passed)
        const errorMessages = failedPhases.flatMap((p) =>
          p.results.filter((r) => !r.passed && r.severity === 'error').map((r) => `[${r.rule}] ${r.message}`)
        )
        return NextResponse.json(
          { error: `Validacia zlyhala pred odoslanim:\n${errorMessages.slice(0, 5).join('\n')}` },
          { status: 400 }
        )
      }
    }
  } catch (valErr) {
    console.error('[send] Pre-send validation error (proceeding anyway):', (valErr as Error).message)
  }

  try {
    const data = await sendDocument(invoice.xml_content)
    const transactionId =
      (data.id != null ? String(data.id) : null) ||
      data.transaction_id ||
      (data as { uuid?: string }).uuid ||
      null

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
    if (err instanceof IonApError) {
      console.error('[peppol/send] ion-AP error:', err.status, err.body)
      return NextResponse.json(
        { error: `ION AP chyba: ${err.status} - ${err.body.substring(0, 200)}` },
        { status: err.status }
      )
    }
    console.error('[peppol/send] fetch error:', err)
    return NextResponse.json(
      { error: 'Nepodarilo sa pripojit k ION AP' },
      { status: 502 }
    )
  }
}
