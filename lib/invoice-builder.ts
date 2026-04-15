import type { PeppolInvoice } from './schemas'
import {
  PEPPOL_IDENTIFIER_SCHEME,
  DEFAULT_ALLOWANCE_REASON_CODE,
  DEFAULT_CHARGE_REASON_CODE,
  allowanceReasonLabel,
  chargeReasonLabel,
} from './constants'

/**
 * Deterministic Peppol BIS 3.0 invoice builder.
 *
 * Implements the line- and document-level calculation rules from Peppol BIS
 * 3.0 chapter 10:
 *   BT-131 = round2((BT-146 / BT-149) * BT-129) + round2(BT-141) - round2(BT-136)
 *   BT-109 = SUM(BT-131) - SUM(BT-92) + SUM(BT-99)
 *   BT-116 per (category, rate) = SUM line amounts + matching charges - matching allowances
 *   BT-117 = round2(BT-116 * BT-119 / 100)
 * Every sub-expression is rounded to 2 decimals separately.
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
  global_discount_reason_code?: string | null
  global_charge_percent?: number
  global_charge_amount?: number
  global_charge_reason_code?: string | null
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
  allowance_reason_code?: string | null
  charge_percent?: number
  charge_amount?: number
  charge_reason_code?: string | null
  base_quantity?: number
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
  // Self-billing MUST use 389, regardless of what is stored
  const typeCode = isSelfBilling ? '389' : (invoice.invoice_type_code || '380')
  // 381 = Credit Note, 384 = Corrective Invoice -- both reference original and use positive values
  const isCreditOrCorrective = typeCode === '381' || typeCode === '384'
  const isVatPayer = profile.is_vat_payer !== false

  // Non-VAT payer: force all items to category O (outside scope), 0% rate
  if (!isVatPayer) {
    items = items.map((it) => ({ ...it, vat_category: 'O', vat_rate: 0 }))
  }

  // ================================================================
  // 1. Build invoice lines per Peppol BIS 3 §10.2
  //    BT-131 = round2((BT-146 / BT-149) * BT-129)
  //             + round2(BT-141) - round2(BT-136)
  //    Each sub-expression rounded to 2 decimals separately.
  // For CreditNote (381) and Corrective Invoice (384): quantities are POSITIVE.
  // ================================================================
  const invoiceLines = items.map((item) => {
    const qty = isCreditOrCorrective ? Math.abs(item.quantity) : item.quantity
    const baseQty = item.base_quantity && item.base_quantity > 0 ? item.base_quantity : 1
    const priceAmount = item.unit_price

    // Price portion (BT-146 / BT-149) * BT-129
    const pricePart = round2((priceAmount / baseQty) * qty)

    // Line allowance (BG-27 / BT-136). Absolute amount wins over percent.
    let allowanceAmt = 0
    let allowanceMultiplier: number | null = null
    if (item.discount_amount && item.discount_amount > 0) {
      allowanceAmt = round2(Math.abs(item.discount_amount))
    } else if (item.discount_percent && item.discount_percent > 0) {
      allowanceMultiplier = item.discount_percent
      allowanceAmt = round2((pricePart * item.discount_percent) / 100)
    }

    // Line charge (BG-28 / BT-141). Absolute amount wins over percent.
    let chargeAmt = 0
    let chargeMultiplier: number | null = null
    if (item.charge_amount && item.charge_amount > 0) {
      chargeAmt = round2(Math.abs(item.charge_amount))
    } else if (item.charge_percent && item.charge_percent > 0) {
      chargeMultiplier = item.charge_percent
      chargeAmt = round2((pricePart * item.charge_percent) / 100)
    }

    const lineExtension = round2(pricePart + chargeAmt - allowanceAmt)

    // Tax category: E/O must pair with 0%; AE implies 0%; anything with rate>0
    // falls back to S (Standard) to keep the invoice well-formed.
    const rate = item.vat_rate ?? 23
    let taxCategory = item.vat_category || 'S'
    if (rate > 0 && (taxCategory === 'E' || taxCategory === 'O')) {
      taxCategory = 'S'
    }

    const lineAllowance = allowanceAmt > 0
      ? {
          amount: allowanceAmt,
          reasonCode: item.allowance_reason_code || DEFAULT_ALLOWANCE_REASON_CODE,
          reason: allowanceReasonLabel(item.allowance_reason_code),
          baseAmount: allowanceMultiplier !== null ? pricePart : null,
          multiplierFactor: allowanceMultiplier,
        }
      : null

    const lineCharge = chargeAmt > 0
      ? {
          amount: chargeAmt,
          reasonCode: item.charge_reason_code || DEFAULT_CHARGE_REASON_CODE,
          reason: chargeReasonLabel(item.charge_reason_code),
          baseAmount: chargeMultiplier !== null ? pricePart : null,
          multiplierFactor: chargeMultiplier,
        }
      : null

    return {
      id: String(item.line_number),
      invoicedQuantity: qty,
      unitCode: item.unit || 'C62',
      lineExtensionAmount: lineExtension,
      itemName: item.description,
      classifiedTaxCategoryId: taxCategory,
      taxPercent: rate,
      priceAmount,
      baseQuantity: baseQty,
      sellersItemIdentification: item.item_number || null,
      buyersItemIdentification: item.buyer_item_number || null,
      lineAllowance,
      lineCharge,
    }
  })

  // ================================================================
  // 2. Sum of line net amounts (BT-106)
  // ================================================================
  const lineExtensionAmountTotal = round2(
    invoiceLines.reduce((sum, l) => sum + l.lineExtensionAmount, 0)
  )

  // ================================================================
  // 3. Document-level allowance (BG-20) and charge (BG-21)
  //    Both can be entered as absolute amount OR percentage; amount wins.
  //    If percentage, the total allowance/charge is computed against the
  //    overall BT-106, then split proportionally per (category, rate) group
  //    so every emitted <cac:AllowanceCharge> carries a consistent tax base.
  // ================================================================
  const globalDiscountAmt = round2(
    invoice.global_discount_amount && invoice.global_discount_amount > 0
      ? invoice.global_discount_amount
      : (lineExtensionAmountTotal * (invoice.global_discount_percent || 0)) / 100
  )
  const globalDiscountMultiplier =
    (!invoice.global_discount_amount || invoice.global_discount_amount <= 0) &&
    (invoice.global_discount_percent || 0) > 0
      ? invoice.global_discount_percent || 0
      : null

  const globalChargeAmt = round2(
    invoice.global_charge_amount && invoice.global_charge_amount > 0
      ? invoice.global_charge_amount
      : (lineExtensionAmountTotal * (invoice.global_charge_percent || 0)) / 100
  )
  const globalChargeMultiplier =
    (!invoice.global_charge_amount || invoice.global_charge_amount <= 0) &&
    (invoice.global_charge_percent || 0) > 0
      ? invoice.global_charge_percent || 0
      : null

  const documentAllowances: PeppolInvoice['documentAllowances'] = []

  // Group lines by (category, rate) for tax calculation and for proportional
  // splitting of document-level allowances/charges.
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

  const discountReasonCode = invoice.global_discount_reason_code || DEFAULT_ALLOWANCE_REASON_CODE
  const chargeReasonCode = invoice.global_charge_reason_code || DEFAULT_CHARGE_REASON_CODE

  if (globalDiscountAmt > 0) {
    for (const [, group] of taxGroups) {
      const proportion = lineExtensionAmountTotal > 0 ? group.lineTotal / lineExtensionAmountTotal : 1
      const allocated = round2(globalDiscountAmt * proportion)
      if (allocated > 0) {
        documentAllowances.push({
          amount: allocated,
          reason: allowanceReasonLabel(discountReasonCode),
          reasonCode: discountReasonCode,
          taxCategoryId: group.catId,
          taxPercent: group.rate,
          isCharge: false,
          baseAmount: globalDiscountMultiplier !== null ? round2(group.lineTotal) : null,
          multiplierFactor: globalDiscountMultiplier,
        })
      }
    }
  }

  if (globalChargeAmt > 0) {
    for (const [, group] of taxGroups) {
      const proportion = lineExtensionAmountTotal > 0 ? group.lineTotal / lineExtensionAmountTotal : 1
      const allocated = round2(globalChargeAmt * proportion)
      if (allocated > 0) {
        documentAllowances.push({
          amount: allocated,
          reason: chargeReasonLabel(chargeReasonCode),
          reasonCode: chargeReasonCode,
          taxCategoryId: group.catId,
          taxPercent: group.rate,
          isCharge: true,
          baseAmount: globalChargeMultiplier !== null ? round2(group.lineTotal) : null,
          multiplierFactor: globalChargeMultiplier,
        })
      }
    }
  }

  // ================================================================
  // 4. Per-group VAT base (BT-116) per §10.4
  //    BT-116 = SUM(line BT-131 in group) + charges in group - allowances in group
  // ================================================================
  const enTaxGroups = new Map<string, { taxBase: number; rate: number; catId: string }>()
  for (const [key, group] of taxGroups) {
    enTaxGroups.set(key, { taxBase: group.lineTotal, rate: group.rate, catId: group.catId })
  }
  for (const entry of documentAllowances) {
    const key = `${entry.taxCategoryId}-${entry.taxPercent}`
    const group = enTaxGroups.get(key)
    if (!group) continue
    if (entry.isCharge) {
      group.taxBase += entry.amount
    } else {
      group.taxBase -= entry.amount
    }
  }
  for (const [, group] of enTaxGroups) {
    group.taxBase = round2(group.taxBase)
  }

  const userAllowancesTotal = round2(
    documentAllowances.filter(a => !a.isCharge).reduce((s, a) => s + a.amount, 0)
  )
  const userChargesTotal = round2(
    documentAllowances.filter(a => a.isCharge).reduce((s, a) => s + a.amount, 0)
  )

  // ================================================================
  // 5. Tax subtotals (BT-117 = BT-116 * BT-119 / 100)
  //    Category O must emit zero tax regardless.
  // ================================================================
  const taxSubtotals: { taxableAmount: number; taxAmount: number; taxCategoryId: string; taxPercent: number; taxExemptionReasonCode: string | null; taxExemptionReason: string | null }[] = []

  for (const [, enGroup] of enTaxGroups) {
    const rate = enGroup.rate
    const taxBase = enGroup.taxBase

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

    const taxAmount = enGroup.catId === 'O' ? 0 : round2(taxBase * rate / 100)

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
  // 6. Legal monetary totals per §10.1
  //    BT-109 = BT-106 - BT-107 + BT-108
  //    BT-112 = BT-109 + BT-110
  //    BT-115 = BT-112
  // ================================================================
  const taxExclusiveAmount = round2(lineExtensionAmountTotal - userAllowancesTotal + userChargesTotal)
  const taxAmountTotal = round2(taxSubtotals.reduce((s, t) => s + t.taxAmount, 0))
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmountTotal)
  const payableAmount = taxInclusiveAmount
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
