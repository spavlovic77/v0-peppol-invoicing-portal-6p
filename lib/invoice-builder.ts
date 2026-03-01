import type { PeppolInvoice } from './schemas'

/**
 * Deterministic Peppol BIS 3.0 invoice builder with Slovak rounding methodology.
 *
 * Slovak tax law calculates tax in reverse: tax = gross * rate / (100 + rate)
 * EN16931 calculates forward: tax = taxBase * rate / 100
 * These two methods produce different results due to rounding.
 *
 * Solution: Calculate using SK method, then emit a corrective AllowanceCharge (BG-20/BG-21)
 * with ReasonCode=ZZZ to bridge the gap so EN16931 validation passes:
 *   BT-116 = SUM(BT-131) + SUM(charges) - SUM(allowances)
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
  note: string | null
  global_discount_percent: number
  global_discount_amount: number
  invoice_type_code?: string
  billing_reference_number?: string | null
  billing_reference_date?: string | null
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
  const typeCode = invoice.invoice_type_code || '380'
  const isCreditNote381 = typeCode === '381'
  const isVatPayer = profile.is_vat_payer !== false

  // Non-VAT payer: force all items to category O (outside scope), 0% rate
  if (!isVatPayer) {
    items = items.map((it) => ({ ...it, vat_category: 'O', vat_rate: 0 }))
  }

  // ================================================================
  // 1. Build invoice lines with per-item discounts
  // For CreditNote (381): quantities and amounts are always POSITIVE
  // For Negative Invoice (380): quantities can be negative
  // ================================================================
  const invoiceLines = items.map((item) => {
    const qty = isCreditNote381 ? Math.abs(item.quantity) : item.quantity
    const grossAmount = round2(qty * item.unit_price)
    const discountAmt = round2(item.discount_amount ? Math.abs(item.discount_amount) : (Math.abs(grossAmount) * (item.discount_percent || 0)) / 100)
    const lineExtension = round2(grossAmount - discountAmt)

    // R120: LineExtensionAmount MUST equal qty * PriceAmount (exactly)
    const netPricePerUnit = qty !== 0 ? round2(lineExtension / qty) : item.unit_price
    const adjustedLineExtension = round2(qty * netPricePerUnit)

    return {
      id: String(item.line_number),
      invoicedQuantity: qty,
      unitCode: item.unit || 'C62',
      lineExtensionAmount: adjustedLineExtension,
      itemName: item.description,
      classifiedTaxCategoryId: item.vat_category || 'S',
      taxPercent: item.vat_rate ?? 23,
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

  // Group lines by tax rate -- track both net total and per-line gross sum
  // For negative invoices (380), lineExtensionAmount can be negative; SK method uses absolute
  const taxGroups = new Map<string, { rate: number; catId: string; lineTotal: number; grossSum: number }>()
  for (const line of invoiceLines) {
    const key = `${line.classifiedTaxCategoryId}-${line.taxPercent}`
    // SK: gross each line individually, then sum (rounding per line)
    const lineGross = round2(line.lineExtensionAmount * (100 + line.taxPercent) / 100)
    const existing = taxGroups.get(key)
    if (existing) {
      existing.lineTotal += line.lineExtensionAmount
      existing.grossSum += lineGross
    } else {
      taxGroups.set(key, { rate: line.taxPercent, catId: line.classifiedTaxCategoryId, lineTotal: line.lineExtensionAmount, grossSum: lineGross })
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
  const taxExclusiveAmount_EN = round2(lineExtensionAmountTotal - userAllowancesTotal)

  // ================================================================
  // 5. SK reverse method: calculate tax and tax base per SK law
  // ================================================================
  // For each tax group:
  //   grossWithVat = taxBase_EN * (100 + rate) / 100
  //   tax_SK = round2(grossWithVat * rate / (100 + rate))
  //   taxBase_SK = round2(grossWithVat - tax_SK)
  //   correction = taxBase_SK - taxBase_EN
  //
  // If correction != 0, emit corrective AllowanceCharge with ZZZ

  let totalCorrections = 0 // net corrections (positive = charge, negative = allowance)

  const skTaxSubtotals: { taxableAmount: number; taxAmount: number; taxCategoryId: string; taxPercent: number }[] = []

  for (const [key, enGroup] of enTaxGroups) {
    const rate = enGroup.rate
    const taxBase_EN = enGroup.taxBase

    if (rate === 0) {
      // Zero-rate: no rounding issue possible
      skTaxSubtotals.push({
        taxableAmount: taxBase_EN,
        taxAmount: 0,
        taxCategoryId: enGroup.catId,
        taxPercent: rate,
      })
      continue
    }

    // Gross with VAT = sum of per-line gross amounts (rounded per line, then summed)
    // This is the SK-correct method: gross each line individually
    const taxGroup = taxGroups.get(key)
    let grossWithVat = taxGroup ? round2(taxGroup.grossSum) : round2(taxBase_EN * (100 + rate) / 100)

    // If global discount was applied, reduce gross proportionally
    if (globalDiscountAmt > 0 && lineExtensionAmountTotal > 0 && taxGroup) {
      const proportion = taxGroup.lineTotal / lineExtensionAmountTotal
      const discountGross = round2(round2(globalDiscountAmt * proportion) * (100 + rate) / 100)
      grossWithVat = round2(grossWithVat - discountGross)
    }

    // SK reverse calculation
    const tax_SK = round2(grossWithVat * rate / (100 + rate))
    const taxBase_SK = round2(grossWithVat - tax_SK)

    // Correction = difference between SK and EN tax bases
    const correction = round2(taxBase_SK - taxBase_EN)

    if (correction !== 0) {
      totalCorrections += correction

      // Charge codes use UNCL 7161 (ZZZ = Mutually defined)
      // Allowance codes use UNCL 5189 (104 = Special agreement)
      const isCharge = correction > 0
      documentAllowances.push({
        amount: round2(Math.abs(correction)),
        reason: 'Vzajomne definovane',
        reasonCode: isCharge ? 'ZZZ' : '104',
        taxCategoryId: enGroup.catId,
        taxPercent: rate,
        isCharge,
      })
    }

    // Use SK values for tax subtotals
    skTaxSubtotals.push({
      taxableAmount: taxBase_SK,
      taxAmount: tax_SK,
      taxCategoryId: enGroup.catId,
      taxPercent: rate,
    })
  }

  // ================================================================
  // 6. Final totals using SK-correct values
  // ================================================================
  // BT-116 taxExclusiveAmount = taxExclusiveAmount_EN + charges - allowances (ZZZ only)
  // Which equals SUM(taxBase_SK) across all groups
  const taxExclusiveAmount = round2(taxExclusiveAmount_EN + totalCorrections)

  const taxAmountTotal = round2(skTaxSubtotals.reduce((s, t) => s + t.taxAmount, 0))
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmountTotal)
  const payableAmount = taxInclusiveAmount

  // Separate allowances and charges for LegalMonetaryTotal
  const allowanceTotalAmount = round2(documentAllowances.filter(a => !a.isCharge).reduce((s, a) => s + a.amount, 0))
  const chargeTotalAmount = round2(documentAllowances.filter(a => a.isCharge).reduce((s, a) => s + a.amount, 0))

  // ================================================================
  // 7. Peppol identifiers
  // ================================================================
  const supplierEndpointId = stripScheme(profile.dic) || profile.ico
  const buyerEndpointId = stripScheme(invoice.buyer_peppol_id) || stripScheme(invoice.buyer_dic) || invoice.buyer_ico || 'N/A'

  return {
    ublVersionID: '2.1',
    customizationID: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    profileID: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    invoiceId: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    invoiceTypeCode: typeCode,
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
    supplierTaxId: isVatPayer
      ? (profile.ic_dph || (profile.dic ? `SK${profile.dic}` : profile.ico))
      : (profile.dic || profile.ico),
    supplierVatId: isVatPayer ? (profile.dic || null) : null,
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
    taxSubtotals: skTaxSubtotals,
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
  }
}
