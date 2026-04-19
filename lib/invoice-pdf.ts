// Server-only helper for generating an invoice PDF as a Buffer.
// Used by both the /api/invoice/pdf route and the send-to-accountant route.
import 'server-only'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoicePdfDocument } from '@/lib/pdf-template'

export interface PdfGenerationResult {
  buffer: Buffer
  invoiceNumber: string
}

export class InvoicePdfError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function generateInvoicePdfBuffer(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string
): Promise<PdfGenerationResult> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single()

  if (!invoice) throw new InvoicePdfError(404, 'Invoice not found')

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('line_number')

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
      .eq('id', userId)
      .single()
    profile = data
  }
  if (!profile) throw new InvoicePdfError(404, 'Supplier profile not found')

  const element = createElement(InvoicePdfDocument, {
    invoice,
    items: items || [],
    profile,
  })

  // Cast through unknown because @react-pdf/renderer's typings for
  // renderToBuffer expect a Document element, but our typed component props
  // don't overlap with DocumentProps. At runtime this works correctly.
  const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])
  return { buffer, invoiceNumber: invoice.invoice_number }
}
