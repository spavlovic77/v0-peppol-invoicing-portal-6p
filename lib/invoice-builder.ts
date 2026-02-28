import type { PeppolInvoice } from './schemas'

/**
 * Deterministic Peppol BIS 3.0 invoice builder.
 * Maps form data + supplier profile to a PeppolInvoice object
 * with 100% accurate arithmetic -- no AI needed.
 */

interface SupplierProfile {
  company_name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country_code: string
  iban: string | null
  swift: string | null
}

interface InvoiceData {
  invoice_number: string
  issue_date: string
  due_date: string
  delivery_date: string | null
  currency: string
  buyer_name: string
  buyer_ico: string | null
  buyer_dic: string | null
  buyer_ic_dph: string | null
  buyer_street: string | null
  buyer_city: string | null
  buyer_postal_code: string | null
  buyer_country_code: string
  buyer_peppol_id: string | null
  order_reference: string | null
  buyer_reference: string | null
  payment_means_code: string
  variable_symbol: string | null
  note: string | null
  global_discount_percent: number
  global_discount_amount: number
}

interface InvoiceItemData {
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  vat_category: string
  vat_rate: number
  discount_percent: number
  discount_amount: number
  item_number: string | null
  buyer_item_number: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function stripScheme(id: string | null): string {
  if (!id) return ''
  return id.replace(/^\d{4}:/, '')
}

export function buildPeppolInvoice(
  invoice: InvoiceData,
  items: InvoiceItemData[],
  profile: SupplierProfile
): PeppolInvoice {
  const currency = invoice.currency || 'EUR'

  // 1. Build invoice lines with per-item discounts
  const invoiceLines = items.map((item) => {
    const grossAmount = round2(item.quantity * item.unit_price)
    const discountAmt = round2(item.discount_amount || (grossAmount * (item.discount_percent || 0)) / 100)
    const lineExtension = round2(grossAmount - discountAmt)

    return {
      id: String(item.line_number),
      invoicedQuantity: item.quantity,
      unitCode: item.unit || 'C62',
      lineExtensionAmount: lineExtension,
      itemName: item.description,
      classifiedTaxCategoryId: item.vat_category || 'S',
      taxPercent: item.vat_rate ?? 20,
      priceAmount: item.unit_price,
      sellersItemIdentification: item.item_number || null,
      buyersItemIdentification: item.buyer_item_number || null,
      allowanceChargeAmount: discountAmt,
      allowanceChargeReason: discountAmt > 0 ? 'Zlava' : null,
    }
  })

  // 2. Sum of all line extension amounts (after per-item discounts)
  const lineExtensionAmountTotal = round2(
    invoiceLines.reduce((sum, l) => sum + l.lineExtensionAmount, 0)
  )

  // 3. Document-level (global) discount
  const globalDiscountAmt = round2(
    invoice.global_discount_amount ||
    (lineExtensionAmountTotal * (invoice.global_discount_percent || 0)) / 100
  )

  // Build document-level allowances array
  // Distribute global discount proportionally across tax categories
  const documentAllowances: PeppolInvoice['documentAllowances'] = []
  if (globalDiscountAmt > 0) {
    // Group lines by tax rate to distribute discount proportionally
    const taxGroups = new Map<string, { rate: number; catId: string; total: number }>()
    for (const line of invoiceLines) {
      const key = `${line.classifiedTaxCategoryId}-${line.taxPercent}`
      const existing = taxGroups.get(key)
      if (existing) {
        existing.total += line.lineExtensionAmount
      } else {
        taxGroups.set(key, { rate: line.taxPercent, catId: line.classifiedTaxCategoryId, total: line.lineExtensionAmount })
      }
    }

    // Proportional distribution
    for (const [, group] of taxGroups) {
      const proportion = lineExtensionAmountTotal > 0 ? group.total / lineExtensionAmountTotal : 1
      const allocatedDiscount = round2(globalDiscountAmt * proportion)
      if (allocatedDiscount > 0) {
        documentAllowances.push({
          amount: allocatedDiscount,
          reason: 'Zlava na fakturu',
          taxCategoryId: group.catId,
          taxPercent: group.rate,
        })
      }
    }
  }

  const allowanceTotalAmount = round2(documentAllowances.reduce((s, a) => s + a.amount, 0))

  // 4. Tax exclusive = line totals minus global discount
  const taxExclusiveAmount = round2(lineExtensionAmountTotal - allowanceTotalAmount)

  // 5. Build tax subtotals by grouping lines by (category, rate)
  const taxMap = new Map<string, { taxableAmount: number; taxCategoryId: string; taxPercent: number }>()
  for (const line of invoiceLines) {
    const key = `${line.classifiedTaxCategoryId}-${line.taxPercent}`
    const existing = taxMap.get(key)
    if (existing) {
      existing.taxableAmount += line.lineExtensionAmount
    } else {
      taxMap.set(key, {
        taxableAmount: line.lineExtensionAmount,
        taxCategoryId: line.classifiedTaxCategoryId,
        taxPercent: line.taxPercent,
      })
    }
  }

  // Subtract document-level allowances from their respective tax groups
  for (const allowance of documentAllowances) {
    const key = `${allowance.taxCategoryId}-${allowance.taxPercent}`
    const group = taxMap.get(key)
    if (group) {
      group.taxableAmount -= allowance.amount
    }
  }

  const taxSubtotals = Array.from(taxMap.values()).map((ts) => ({
    taxableAmount: round2(ts.taxableAmount),
    taxAmount: round2(ts.taxableAmount * ts.taxPercent / 100),
    taxCategoryId: ts.taxCategoryId,
    taxPercent: ts.taxPercent,
  }))

  // 6. Totals
  const taxAmountTotal = round2(taxSubtotals.reduce((s, t) => s + t.taxAmount, 0))
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmountTotal)
  const payableAmount = taxInclusiveAmount

  // 7. Peppol identifiers
  const supplierEndpointId = stripScheme(profile.dic) || profile.ico
  const buyerEndpointId = stripScheme(invoice.buyer_peppol_id) || stripScheme(invoice.buyer_dic) || invoice.buyer_ico || 'N/A'

  return {
    ublVersionID: '2.1',
    customizationID: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    profileID: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    invoiceId: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    invoiceTypeCode: '380',
    documentCurrencyCode: currency,
    buyerReference: invoice.buyer_reference || invoice.order_reference || invoice.invoice_number,
    orderReferenceId: invoice.order_reference || null,
    supplierEndpointId,
    supplierEndpointSchemeId: '9950',
    supplierPartyName: profile.company_name,
    supplierStreet: profile.street || '',
    supplierCity: profile.city || '',
    supplierPostalCode: profile.postal_code || '',
    supplierCountryCode: profile.country_code || 'SK',
    supplierCompanyId: profile.ico,
    supplierTaxId: profile.ic_dph || (profile.dic ? `SK${profile.dic}` : profile.ico),
    supplierVatId: profile.dic || null,
    customerEndpointId: buyerEndpointId,
    customerEndpointSchemeId: '9950',
    customerPartyName: invoice.buyer_name,
    customerStreet: invoice.buyer_street || '',
    customerCity: invoice.buyer_city || '',
    customerPostalCode: invoice.buyer_postal_code || '',
    customerCountryCode: invoice.buyer_country_code || 'SK',
    customerCompanyId: invoice.buyer_ico || null,
    customerTaxId: invoice.buyer_ic_dph || null,
    paymentMeansCode: invoice.payment_means_code || '30',
    paymentId: invoice.variable_symbol || null,
    iban: profile.iban || null,
    bic: profile.swift || null,
    taxSubtotals,
    taxAmountTotal,
    lineExtensionAmountTotal,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    allowanceTotalAmount,
    documentAllowances,
    invoiceLines,
    invoiceNote: invoice.note || null,
    deliveryDate: invoice.delivery_date || null,
  }
}
