import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { generateInvoicePdfBuffer, InvoicePdfError } from '@/lib/invoice-pdf'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || ''

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const invoiceId = body?.invoiceId || body?.invoice_id
  const overrideEmail: string | undefined = body?.email

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return NextResponse.json(
      { error: 'E-mailová služba nie je nakonfigurovaná (RESEND_API_KEY/FROM)' },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, xml_content, supplier_id, buyer_name, currency, total_with_vat, issue_date, due_date')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Faktura nenajdena' }, { status: 404 })
  }
  if (!invoice.xml_content) {
    return NextResponse.json({ error: 'Faktura nema vygenerovane XML' }, { status: 400 })
  }
  if (!invoice.supplier_id) {
    return NextResponse.json({ error: 'Faktura nema priradeneho dodavatela' }, { status: 400 })
  }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('company_name, accountant_email')
    .eq('id', invoice.supplier_id)
    .eq('user_id', user.id)
    .single()

  const recipient = (overrideEmail || supplier?.accountant_email || '').trim()
  if (!recipient) {
    return NextResponse.json(
      { error: 'E-mail účtovníčky nie je nastavený na dodávateľovi' },
      { status: 400 }
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json(
      { error: 'Neplatný e-mail účtovníčky' },
      { status: 400 }
    )
  }

  // Build the PDF
  let pdfBuffer: Buffer
  try {
    const res = await generateInvoicePdfBuffer(supabase, user.id, invoiceId)
    pdfBuffer = res.buffer
  } catch (err) {
    if (err instanceof InvoicePdfError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[send-to-accountant] PDF gen failed:', err)
    return NextResponse.json({ error: 'Zlyhalo generovanie PDF' }, { status: 500 })
  }

  // Zip XML + PDF, both named after the invoice number
  const safeNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const zip = new JSZip()
  zip.file(`${safeNumber}.xml`, invoice.xml_content)
  zip.file(`${safeNumber}.pdf`, pdfBuffer)
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  // Compose email body (default template — Slovak)
  const totalFmt = Number(invoice.total_with_vat ?? 0).toLocaleString('sk-SK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const subject = `Faktúra ${invoice.invoice_number} — ${supplier?.company_name ?? ''}`.trim()
  const intro = supplier?.company_name ? `${supplier.company_name} posiela` : 'Posielame'
  const bodyText =
    `Dobrý deň,\n\n` +
    `${intro} faktúru ${invoice.invoice_number} pre odberateľa ${invoice.buyer_name}.\n\n` +
    `Dátum vystavenia: ${invoice.issue_date}\n` +
    `Splatnosť: ${invoice.due_date}\n` +
    `Suma s DPH: ${totalFmt} ${invoice.currency}\n\n` +
    `V prílohe nájdete zazipované XML (e-faktúra) a PDF (vizuál).\n\n` +
    `S pozdravom,\n${supplier?.company_name ?? ''}`
  const bodyHtml =
    `<p>Dobrý deň,</p>` +
    `<p>${intro} faktúru <strong>${invoice.invoice_number}</strong> pre odberateľa <strong>${invoice.buyer_name}</strong>.</p>` +
    `<ul>` +
    `<li>Dátum vystavenia: ${invoice.issue_date}</li>` +
    `<li>Splatnosť: ${invoice.due_date}</li>` +
    `<li>Suma s DPH: <strong>${totalFmt} ${invoice.currency}</strong></li>` +
    `</ul>` +
    `<p>V prílohe nájdete zazipované XML (e-faktúra) a PDF (vizuál).</p>` +
    `<p>S pozdravom,<br/>${supplier?.company_name ?? ''}</p>`

  const resend = new Resend(RESEND_API_KEY)
  try {
    const { data, error: sendErr } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [recipient],
      subject,
      text: bodyText,
      html: bodyHtml,
      attachments: [
        {
          filename: `${safeNumber}.zip`,
          content: zipBuffer,
        },
      ],
    })
    if (sendErr) {
      console.error('[send-to-accountant] Resend error:', sendErr)
      return NextResponse.json(
        { error: `Odoslanie zlyhalo: ${sendErr.message || 'neznáma chyba'}` },
        { status: 502 }
      )
    }

    const sentAt = new Date().toISOString()
    await supabase
      .from('invoices')
      .update({
        sent_to_accountant_at: sentAt,
        sent_to_accountant_email: recipient,
      })
      .eq('id', invoiceId)

    return NextResponse.json({
      success: true,
      email: recipient,
      sent_at: sentAt,
      resend_id: data?.id ?? null,
    })
  } catch (err) {
    console.error('[send-to-accountant] unexpected:', err)
    return NextResponse.json(
      { error: 'Nepodarilo sa odoslať e-mail' },
      { status: 502 }
    )
  }
}
