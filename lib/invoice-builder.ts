import type { PeppolInvoice } from './schemas'
import { PEPPOL_IDENTIFIER_SCHEME } from './constants'

/**
 * Deterministic Peppol BIS 3.0 invoice builder.
 *
 * Uses EN16931 forward VAT calculation as per Peppol BIS 3.0 chapter 10.4:
 *   tax = taxBase * rate / 100
 *   taxBase = SUM(line extension amounts) - allowances + charges
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
  is_vat_payer?: boolean
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
  iban: string | null
  bank_name: string | null
  swift: string | null
  note: string | null
  global_discount_percent: number
  global_discount_amount: number
  invoice_type_code?: string
  invoice_mode?: string
  billing_reference_number?: string | null
  billing_reference_date?: string | null
  attachments?: Array<{ id: string; filename: string; mimeCode: string; description: string; data: string; size: number }>
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
  const invoiceMode = invoice.invoice_mode || 'standard'
  const isSelfBilling = invoiceMode === 'selfbilling'
  const isReverseCharge = invoiceMode === 'reversecharge'
  // Self-billing MUST use 389, regardless of what is stored
  const typeCode = isSelfBilling ? '389' : (invoice.invoice_type_code || '380')
  // 381 = Credit Note, 384 = Corrective Invoice -- both reference original and use positive values
  const isCreditOrCorrective = typeCode === '381' || typeCode === '384'
  const isVatPayer = profile.is_vat_payer !== false

  // Non-VAT payer: force all items to category O (outside scope), 0% rate
  if (!isVatPayer) {
    items = items.map((it) => ({ ...it, vat_category: 'O', vat_rate: 0 }))
  }

  // Reverse charge: force all items to category AE, 0% rate
  if (isReverseCharge) {
    items = items.map((it) => ({ ...it, vat_category: 'AE', vat_rate: 0 }))
  }

  // ================================================================
  // 1. Build invoice lines with per-item discounts
  // For CreditNote (381) and Corrective Invoice (384): quantities and amounts are always POSITIVE
  // ================================================================
  const invoiceLines = items.map((item) => {
    const qty = isCreditOrCorrective ? Math.abs(item.quantity) : item.quantity
    const grossAmount = round2(qty * item.unit_price)
    const discountAmt = round2(item.discount_amount ? Math.abs(item.discount_amount) : (Math.abs(grossAmount) * (item.discount_percent || 0)) / 100)
    const lineExtension = round2(grossAmount - discountAmt)

    // R120: LineExtensionAmount MUST equal qty * PriceAmount (exactly)
    const netPricePerUnit = qty !== 0 ? round2(lineExtension / qty) : item.unit_price
    const adjustedLineExtension = round2(qty * netPricePerUnit)

    // Determine correct tax category based on rate and user input
    // E (Exempt) and O (Outside scope) require 0% rate; AE (Reverse charge) also requires 0%
    // If rate > 0, force category to S (Standard)
    const rate = item.vat_rate ?? 23
    let taxCategory = item.vat_category || 'S'
    if (rate > 0 && (taxCategory === 'E' || taxCategory === 'O')) {
      taxCategory = 'S' // Force standard category for non-zero rates
    }
    
    return {
      id: String(item.line_number),
      invoicedQuantity: qty,
      unitCode: item.unit || 'C62',
      lineExtensionAmount: adjustedLineExtension,
      itemName: item.description,
      classifiedTaxCategoryId: taxCategory,
      taxPercent: rate,
      priceAmount: netPricePerUnit,
      sellersItemIdentification: item.item_number || null,
      buyersItemIdentification: item.buyer_item_number || null,
      allowanceChargeAmount: discountAmt,
      allowanceChargeReason: discountAmt > 0 ? 'Zlava' : null,
    }
  })

  // ================================================================
  // 2. Sum of all line extension amounts (BT-131 sum)
  // ================================================================
  const lineExtensionAmountTotal = round2(
    invoiceLines.reduce((sum, l) => sum + l.lineExtensionAmount, 0)
  )

  // ================================================================
  // 3. Document-level user discounts (global discount)
  // ================================================================
  const globalDiscountAmt = round2(
    invoice.global_discount_amount ||
    (lineExtensionAmountTotal * (invoice.global_discount_percent || 0)) / 100
  )

  const documentAllowances: PeppolInvoice['documentAllowances'] = []

  // Group lines by tax rate for EN16931 tax calculation
  const taxGroups = new Map<string, { rate: number; catId: string; lineTotal: number }>()
  for (const line of invoiceLines) {
    const key = `${line.classifiedTaxCategoryId}-${line.taxPercent}`
    const existing = taxGroups.get(key)
    if (existing) {
      existing.lineTotal += line.lineExtensionAmount
    } else {
      taxGroups.set(key, { rate: line.taxPercent, catId: line.classifiedTaxCategoryId, lineTotal: line.lineExtensionAmount })
    }
  }

  // Distribute global discount proportionally across tax categories
  if (globalDiscountAmt > 0) {
    for (const [, group] of taxGroups) {
      const proportion = lineExtensionAmountTotal > 0 ? group.lineTotal / lineExtensionAmountTotal : 1
      const allocatedDiscount = round2(globalDiscountAmt * proportion)
      if (allocatedDiscount > 0) {
        documentAllowances.push({
          amount: allocatedDiscount,
          reason: 'Zlava na fakturu',
          reasonCode: '95',
          taxCategoryId: group.catId,
          taxPercent: group.rate,
          isCharge: false,
        })
      }
    }
  }

  // ================================================================
  // 4. Calculate tax base per EN method (forward)
  // ================================================================
  // taxBase_EN per group = lineTotal - userDiscount
  const enTaxGroups = new Map<string, { taxBase: number; rate: number; catId: string }>()
  for (const [key, group] of taxGroups) {
    enTaxGroups.set(key, { taxBase: group.lineTotal, rate: group.rate, catId: group.catId })
  }
  // Subtract user discounts
  for (const allowance of documentAllowances.filter(a => !a.isCharge && a.reasonCode !== 'ZZZ')) {
    const key = `${allowance.taxCategoryId}-${allowance.taxPercent}`
    const group = enTaxGroups.get(key)
    if (group) {
      group.taxBase -= allowance.amount
    }
  }

  // Round EN tax bases
  for (const [, group] of enTaxGroups) {
    group.taxBase = round2(group.taxBase)
  }

  const userAllowancesTotal = round2(documentAllowances.filter(a => !a.isCharge).reduce((s, a) => s + a.amount, 0))
  const userChargesTotal = round2(documentAllowances.filter(a => a.isCharge).reduce((s, a) => s + a.amount, 0))

  // ================================================================
  // 5. EN16931 forward VAT calculation (Peppol BIS 3.0 chapter 10.4)
  // ================================================================
  // tax = taxBase * rate / 100
  // taxBase = lineExtensionAmountTotal - allowances + charges (per tax category)

  const taxSubtotals: { taxableAmount: number; taxAmount: number; taxCategoryId: string; taxPercent: number; taxExemptionReasonCode: string | null; taxExemptionReason: string | null }[] = []

  for (const [, enGroup] of enTaxGroups) {
    const rate = enGroup.rate
    const taxBase = enGroup.taxBase

    // Determine exemption reason for zero-rate categories (VATEX codes must be uppercase)
    let exemptionCode: string | null = null
    let exemptionReason: string | null = null
    if (rate === 0) {
      if (enGroup.catId === 'AE') {
        exemptionCode = 'VATEX-EU-AE'
        exemptionReason = 'Reverse charge'
      } else if (enGroup.catId === 'O') {
        exemptionCode = 'VATEX-EU-O'
        exemptionReason = 'Not subject to VAT'
      } else if (enGroup.catId === 'E') {
        exemptionCode = 'VATEX-EU-132'
        exemptionReason = 'Exempt from VAT'
      }
    }

    // EN16931 forward calculation: tax = taxBase * rate / 100
    const taxAmount = round2(taxBase * rate / 100)

    taxSubtotals.push({
      taxableAmount: taxBase,
      taxAmount,
      taxCategoryId: enGroup.catId,
      taxPercent: rate,
      taxExemptionReasonCode: exemptionCode,
      taxExemptionReason: exemptionReason,
    })
  }

  // ================================================================
  // 6. Final totals using EN16931 values
  // ================================================================
  // BT-116 taxExclusiveAmount = SUM(BT-131) - allowances + charges
  const taxExclusiveAmount = round2(lineExtensionAmountTotal - userAllowancesTotal + userChargesTotal)
  const taxAmountTotal = round2(taxSubtotals.reduce((s, t) => s + t.taxAmount, 0))
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmountTotal)
  const payableAmount = taxInclusiveAmount

  // Separate allowances and charges for LegalMonetaryTotal
  const allowanceTotalAmount = userAllowancesTotal
  const chargeTotalAmount = userChargesTotal

  // ================================================================
  // 7. Peppol identifiers + self-billing role swap
  // ================================================================
  // For Self-Billing (389): the issuer (buyer) is AccountingCustomerParty,
  // and the supplier of goods/services is AccountingSupplierParty.
  // In our system: profile = the user's company (the buyer/issuer in self-billing)
  //                invoice.buyer_* = the counterparty (the supplier in self-billing)

  let customizationID: string
  let profileID: string
  if (isSelfBilling) {
    customizationID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0'
    profileID = 'urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0'
  } else {
    customizationID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
    profileID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'
  }

  // Self-billing swaps: AccountingSupplierParty = the counterparty (goods supplier)
  //                     AccountingCustomerParty = our company (the buyer/issuer)
  const supplierEndpointId = isSelfBilling
    ? (stripScheme(invoice.buyer_dic) || invoice.buyer_ico || 'N/A')
    : (stripScheme(profile.dic) || profile.ico)
  const buyerEndpointId = isSelfBilling
    ? (stripScheme(profile.dic) || profile.ico)
    : (stripScheme(invoice.buyer_peppol_id) || stripScheme(invoice.buyer_dic) || invoice.buyer_ico || 'N/A')

  // Determine supplier/customer party details based on mode
  const supplierParty = isSelfBilling ? {
    name: invoice.buyer_name,
    street: invoice.buyer_street || '',
    city: invoice.buyer_city || '',
    postalCode: invoice.buyer_postal_code || '',
    countryCode: invoice.buyer_country_code || 'SK',
    companyId: invoice.buyer_ico || '',
    taxId: invoice.buyer_ic_dph || null,
    vatId: invoice.buyer_dic || null,
  } : {
    name: profile.company_name,
    street: profile.street || '',
    city: profile.city || '',
    postalCode: profile.postal_code || '',
    countryCode: profile.country_code || 'SK',
    companyId: profile.ico,
    taxId: isVatPayer ? (profile.ic_dph || (profile.dic ? `SK${profile.dic}` : profile.ico)) : (profile.dic || profile.ico),
    vatId: isVatPayer ? (profile.dic || null) : null,
  }

  const customerParty = isSelfBilling ? {
    name: profile.company_name,
    street: profile.street || '',
    city: profile.city || '',
    postalCode: profile.postal_code || '',
    countryCode: profile.country_code || 'SK',
    companyId: profile.ico,
    taxId: profile.ic_dph || null,
  } : {
    name: invoice.buyer_name,
    street: invoice.buyer_street || '',
    city: invoice.buyer_city || '',
    postalCode: invoice.buyer_postal_code || '',
    countryCode: invoice.buyer_country_code || 'SK',
    companyId: invoice.buyer_ico || null,
    taxId: invoice.buyer_ic_dph || null,
  }

  return {
    ublVersionID: '2.1',
    customizationID,
    profileID,
    invoiceId: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    invoiceTypeCode: typeCode,
    documentCurrencyCode: currency,
    buyerReference: invoice.buyer_reference || invoice.order_reference || invoice.invoice_number,
    orderReferenceId: invoice.order_reference || null,
    supplierEndpointId,
    supplierEndpointSchemeId: PEPPOL_IDENTIFIER_SCHEME,
    supplierPartyName: supplierParty.name,
    supplierStreet: supplierParty.street,
    supplierCity: supplierParty.city,
    supplierPostalCode: supplierParty.postalCode,
    supplierCountryCode: supplierParty.countryCode,
    supplierCompanyId: supplierParty.companyId,
    supplierTaxId: supplierParty.taxId || supplierParty.companyId,
    supplierVatId: supplierParty.vatId || null,
    customerEndpointId: buyerEndpointId,
    customerEndpointSchemeId: PEPPOL_IDENTIFIER_SCHEME,
    customerPartyName: customerParty.name,
    customerStreet: customerParty.street,
    customerCity: customerParty.city,
    customerPostalCode: customerParty.postalCode,
    customerCountryCode: customerParty.countryCode,
    customerCompanyId: customerParty.companyId,
    customerTaxId: customerParty.taxId,
    paymentMeansCode: invoice.payment_means_code || '30',
    paymentId: invoice.variable_symbol || null,
    iban: invoice.iban || profile.iban || null,
    bic: invoice.swift || profile.swift || null,
    taxSubtotals,
    taxAmountTotal,
    lineExtensionAmountTotal,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    allowanceTotalAmount,
    chargeTotalAmount,
    documentAllowances,
    invoiceLines,
    invoiceNote: invoice.note || null,
    deliveryDate: invoice.delivery_date || null,
    billingReferenceNumber: invoice.billing_reference_number || null,
    billingReferenceDate: invoice.billing_reference_date || null,
    additionalDocumentReferences: (invoice.attachments || []).map(att => ({
      id: att.id,
      description: att.description || null,
      filename: att.filename,
      mimeCode: att.mimeCode,
      data: att.data,
    })),
  }
}
