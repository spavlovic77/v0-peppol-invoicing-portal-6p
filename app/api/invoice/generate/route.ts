import { generateText, Output } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { peppolInvoiceSchema } from '@/lib/schemas'
import type { PeppolInvoice } from '@/lib/schemas'
import { buildUblXml } from '@/lib/ubl-builder'
import { validateInvoice } from '@/lib/validation'
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

    // Fetch invoice with items
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Faktura nenajdena' }, { status: 404 })
    }

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number')

    if (itemsError) {
      return NextResponse.json({ error: 'Chyba pri nacitani poloziek' }, { status: 500 })
    }

    // Fetch supplier profile
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Firemny profil nenajdeny' }, { status: 404 })
    }

    // Build prompt with all invoice data
    const supplierPeppolId = profile.dic || profile.ico
    const buyerPeppolId = invoice.buyer_dic || invoice.buyer_ico || 'N/A'
    
    const prompt = `You are a Peppol BIS 3.0 e-invoicing expert. Generate a complete, valid Peppol BIS Billing 3.0 UBL invoice JSON from the following data.

IMPORTANT RULES:
- CustomizationID MUST be exactly: "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
- ProfileID MUST be exactly: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
- For Slovakia, endpoint schemeID is "0245" and the endpoint ID is the DIC number
- Invoice type code 380 = standard invoice
- Payment means code 30 = bank transfer (Credit transfer)
- All monetary amounts must be calculated precisely to 2 decimal places
- Tax amounts: taxableAmount * (taxPercent / 100) rounded to 2 decimals
- lineExtensionAmount = quantity * priceAmount for each line
- taxExclusiveAmount = sum of all lineExtensionAmount
- taxInclusiveAmount = taxExclusiveAmount + taxAmountTotal
- payableAmount = taxInclusiveAmount
- BuyerReference is REQUIRED for Peppol - use order reference or invoice number as fallback

SUPPLIER DATA:
- Name: ${profile.company_name}
- ICO: ${profile.ico}
- DIC: ${profile.dic || 'N/A'}
- IC DPH: ${profile.ic_dph || 'N/A'}
- Street: ${profile.street || ''}
- City: ${profile.city || ''}
- Postal Code: ${profile.postal_code || ''}
- Country: ${profile.country_code || 'SK'}
- IBAN: ${profile.iban || ''}
- SWIFT/BIC: ${profile.swift || ''}
- Peppol Endpoint (0245): ${supplierPeppolId}

BUYER DATA:
- Name: ${invoice.buyer_name}
- ICO: ${invoice.buyer_ico || 'N/A'}
- DIC: ${invoice.buyer_dic || 'N/A'}  
- IC DPH: ${invoice.buyer_ic_dph || 'N/A'}
- Street: ${invoice.buyer_street || ''}
- City: ${invoice.buyer_city || ''}
- Postal Code: ${invoice.buyer_postal_code || ''}
- Country: ${invoice.buyer_country_code || 'SK'}
- Buyer Peppol ID: ${invoice.buyer_peppol_id || buyerPeppolId}

INVOICE DATA:
- Invoice Number: ${invoice.invoice_number}
- Issue Date: ${invoice.issue_date}
- Due Date: ${invoice.due_date}
- Delivery Date: ${invoice.delivery_date || invoice.issue_date}
- Currency: ${invoice.currency || 'EUR'}
- Order Reference: ${invoice.order_reference || ''}
- Buyer Reference: ${invoice.buyer_reference || invoice.order_reference || invoice.invoice_number}
- Variable Symbol (PaymentID): ${invoice.variable_symbol || ''}
- Note: ${invoice.note || ''}

LINE ITEMS:
${(items || []).map((item: Record<string, unknown>, i: number) => 
  `${i + 1}. "${item.description}" - Qty: ${item.quantity}, Unit: ${item.unit || 'C62'}, Price: ${item.unit_price} EUR, VAT: ${item.vat_rate}% (category: ${item.vat_category || 'S'})`
).join('\n')}

Calculate all totals precisely. Ensure the VAT breakdown (taxSubtotals) groups items by VAT rate.`

    // Use AI SDK with Output.object() for structured generation
    const result = await generateText({
      model: 'openai/gpt-4.1',
      prompt,
      output: Output.object({ schema: peppolInvoiceSchema }),
      temperature: 0.1,
    })

    const peppolInvoice = result.output as PeppolInvoice
    if (!peppolInvoice) {
      return NextResponse.json({ error: 'AI nedokazal vygenerovat fakturu' }, { status: 500 })
    }

    // Build the UBL XML from the structured output
    const xml = buildUblXml(peppolInvoice)

    // Run 3-phase validation
    const validationResults = validateInvoice(peppolInvoice)
    const allPassed = validationResults.every((phase) => phase.passed)

    // Save XML and validation to database
    await supabase
      .from('invoices')
      .update({
        xml_content: xml,
        validation_errors: validationResults,
        status: allPassed ? 'valid' : 'invalid',
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
