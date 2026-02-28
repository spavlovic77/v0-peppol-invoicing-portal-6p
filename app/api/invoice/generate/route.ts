import { createClient } from '@/lib/supabase/server'
import { buildPeppolInvoice } from '@/lib/invoice-builder'
import { buildUblXml } from '@/lib/ubl-builder'
import { validateInvoiceXml } from '@/lib/real-validation'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })
    }

    // Fetch invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Faktura nenajdena' }, { status: 404 })
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number')

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Chyba pri nacitani poloziek' }, { status: 500 })
    }

    // Fetch supplier profile
    let profile
    if (invoice.supplier_id) {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', invoice.supplier_id)
        .single()
      profile = data
    }
    if (!profile) {
      const { data } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      profile = data
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profil dodavatela nenajdeny' }, { status: 404 })
    }

    // Deterministic build -- no AI, no cost, instant
    const peppolInvoice = buildPeppolInvoice(invoice, items, profile)

    // Build UBL XML
    const xml = buildUblXml(peppolInvoice)

    // Debug: log full XML
    const xmlLines = xml.split('\n')
    console.log(`[v0] XML total lines: ${xmlLines.length}`)
    // Log lines around the error area (100-120)
    xmlLines.slice(99, 125).forEach((line, i) => console.log(`[v0] L${100 + i}: ${line}`))
    // Also log invoice data for debugging
    console.log(`[v0] payment_means_code: "${invoice.payment_means_code}"`)
    console.log(`[v0] global_discount_percent: ${invoice.global_discount_percent}`)
    console.log(`[v0] items count: ${items.length}`)

    // Validate
    const validationResults = await validateInvoiceXml(xml, peppolInvoice)
    const allPassed = validationResults.every((phase) => phase.passed)

    // Save to database
    await supabase
      .from('invoices')
      .update({
        xml_content: xml,
        validation_errors: validationResults,
        status: allPassed ? 'valid' : 'invalid',
        ai_prompt_tokens: 0,
        ai_completion_tokens: 0,
        ai_total_tokens: 0,
        ai_cost_usd: 0,
        ai_model: 'deterministic',
      })
      .eq('id', invoiceId)

    return NextResponse.json({
      xml,
      peppolInvoice,
      validation: validationResults,
      allPassed,
    })
  } catch (err) {
    console.error('Generate invoice error:', err)
    return NextResponse.json(
      { error: 'Chyba pri generovani faktury: ' + (err as Error).message },
      { status: 500 }
    )
  }
}
