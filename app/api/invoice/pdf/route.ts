import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvoicePdfBuffer, InvoicePdfError } from '@/lib/invoice-pdf'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get('id')
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { buffer, invoiceNumber } = await generateInvoicePdfBuffer(supabase, user.id, invoiceId)

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      },
    })
  } catch (err) {
    if (err instanceof InvoicePdfError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    console.error('[v0] PDF generation error:', e.message, e.stack)
    return NextResponse.json(
      { error: 'PDF generation failed', detail: e.message },
      { status: 500 }
    )
  }
}
