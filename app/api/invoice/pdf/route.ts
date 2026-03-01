import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoicePdfDocument } from '@/lib/pdf-template'

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

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number')

    // Fetch supplier from suppliers table using invoice.supplier_id
    let profile
    if (invoice.supplier_id) {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', invoice.supplier_id)
        .single()
      profile = data
    }
    // Fallback to legacy company_profiles for old invoices
    if (!profile) {
      const { data } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      profile = data
    }

    if (!profile) {
      return NextResponse.json({ error: 'Supplier profile not found' }, { status: 404 })
    }

    const element = createElement(InvoicePdfDocument, {
      invoice,
      items: items || [],
      profile,
    })

    console.log('[v0] PDF element created, starting renderToBuffer...')
    let buffer: Buffer
    try {
      buffer = await renderToBuffer(element)
      console.log('[v0] PDF buffer generated, size:', buffer.length)
    } catch (renderErr) {
      const re = renderErr as Error
      console.error('[v0] renderToBuffer failed:', re.message, re.stack)
      throw renderErr
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    const e = err as Error
    console.error('[v0] PDF generation error:', e.message, e.stack)
    return NextResponse.json(
      { error: 'PDF generation failed', detail: e.message },
      { status: 500 }
    )
  }
}
