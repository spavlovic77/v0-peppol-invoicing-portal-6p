import { z } from 'zod'

// Company profile schema
export const companyProfileSchema = z.object({
  ico: z.string().min(6).max(8),
  dic: z.string().min(8).max(12).nullable(),
  ic_dph: z.string().max(14).nullable(),
  company_name: z.string().min(1, 'Nazov firmy je povinny'),
  street: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().max(10).nullable(),
  country_code: z.string().length(2).default('SK'),
  bank_name: z.string().nullable(),
  iban: z.string().max(34).nullable(),
  swift: z.string().max(11).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  web: z.string().nullable(),
  registration_court: z.string().nullable(),
  registration_number: z.string().nullable(),
  is_vat_payer: z.boolean().optional().default(true),
})

export type CompanyProfile = z.infer<typeof companyProfileSchema>

// Invoice item schema
export const invoiceItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1, 'Popis položky je povinný'),
  quantity: z.number().refine(v => v !== 0, 'Množstvo nesmie byť nula'),
  unit: z.string().default('C62'),
  unit_price: z.number(),
  vat_category: z.string().default('S'),
  vat_rate: z.number().min(0).max(100).default(23),
  discount_percent: z.number().min(0).max(100).default(0),
  discount_amount: z.number().min(0).default(0),
  line_total: z.number(),
  item_number: z.string().nullable(),
  buyer_item_number: z.string().nullable(),
})

export type InvoiceItem = z.infer<typeof invoiceItemSchema>

// Attachment schema (EN16931 BG-24)
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
] as const

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // 5 MB per file

export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeCode: z.string(),
  description: z.string().default(''),
  data: z.string(), // base64-encoded content
  size: z.number(), // original file size in bytes
})

export type InvoiceAttachment = z.infer<typeof attachmentSchema>

// Invoice schema
export const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Číslo faktúry je povinné'),
  issue_date: z.string().min(1, 'Dátum vyhotovenia je povinný'),
  due_date: z.string().min(1, 'Dátum splatnosti je povinný'),
  delivery_date: z.string().nullable(),
  currency: z.string().default('EUR'),
  buyer_ico: z.string().nullable(),
  buyer_dic: z.string().nullable(),
  buyer_ic_dph: z.string().nullable(),
  buyer_name: z.string().min(1, 'Názov odberateľa je povinny'),
  buyer_street: z.string().nullable(),
  buyer_city: z.string().nullable(),
  buyer_postal_code: z.string().nullable(),
  buyer_country_code: z.string().length(2).default('SK'),
  buyer_email: z.string().nullable(),
  buyer_peppol_id: z.string().nullable(),
  order_reference: z.string().nullable(),
  buyer_reference: z.string().nullable(),
  payment_means_code: z.string().default('30'),
  bank_name: z.string().nullable(),
  iban: z.string().nullable(),
  swift: z.string().nullable(),
  variable_symbol: z.string().nullable(),
  note: z.string().nullable(),
  global_discount_percent: z.number().min(0).max(100).default(0),
  global_discount_amount: z.number().min(0).default(0),
  invoice_mode: z.enum(['standard', 'selfbilling', 'reversecharge']).default('standard'),
  invoice_type_code: z.string().default('380'),
  correction_of: z.string().nullable().default(null),
  correction_reason: z.string().nullable().default(null),
  billing_reference_number: z.string().nullable().default(null),
  billing_reference_date: z.string().nullable().default(null),
  items: z.array(invoiceItemSchema).min(1, 'Faktúra musí mať aspoň jednu položku'),
  attachments: z.array(attachmentSchema).default([]),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

// Peppol UBL Invoice structured output schema (for AI generation)
export const peppolInvoiceLineSchema = z.object({
  id: z.string().describe('Line ID (sequential number)'),
  invoicedQuantity: z.number().describe('Quantity of items'),
  unitCode: z.string().describe('UN/ECE rec 20 unit code, e.g. C62 for unit, HUR for hour'),
  lineExtensionAmount: z.number().describe('Line net amount = quantity * price'),
  itemName: z.string().describe('Item name/description'),
  classifiedTaxCategoryId: z.string().describe('Tax category: S=standard, E=exempt/zero, AE=reverse charge'),
  taxPercent: z.number().describe('VAT percentage, e.g. 20 for 20%'),
  priceAmount: z.number().describe('Price per unit without VAT'),
  sellersItemIdentification: z.string().nullable().describe('Seller item number'),
  buyersItemIdentification: z.string().nullable().describe('Buyer item number'),
  allowanceChargeAmount: z.number().default(0).describe('Line-level discount amount'),
  allowanceChargeReason: z.string().nullable().describe('Reason for discount, e.g. "Zlava"'),
})

export const peppolTaxSubtotalSchema = z.object({
  taxableAmount: z.number().describe('Sum of line amounts for this tax category'),
  taxAmount: z.number().describe('Tax amount for this category'),
  taxCategoryId: z.string().describe('Tax category code'),
  taxPercent: z.number().describe('Tax rate percentage'),
  taxExemptionReasonCode: z.string().nullable().default(null).describe('Tax exemption reason code, e.g. vatex-eu-ae for reverse charge'),
  taxExemptionReason: z.string().nullable().default(null).describe('Tax exemption reason text, e.g. Reverse charge'),
})

export const peppolInvoiceSchema = z.object({
  ublVersionID: z.string().describe('Always "2.1"'),
  customizationID: z.string().describe('Always "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"'),
  profileID: z.string().describe('Always "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"'),
  invoiceId: z.string().describe('Invoice number'),
  issueDate: z.string().describe('Issue date YYYY-MM-DD'),
  dueDate: z.string().describe('Due date YYYY-MM-DD'),
  invoiceTypeCode: z.string().describe('380 for invoice, 381 for credit note'),
  documentCurrencyCode: z.string().describe('Currency code, e.g. EUR'),
  buyerReference: z.string().describe('Buyer reference or order reference. Required by Peppol.'),
  orderReferenceId: z.string().nullable().describe('Purchase order reference'),
  supplierEndpointId: z.string().describe('Supplier Peppol ID, format: DIČ number'),
  supplierEndpointSchemeId: z.string().describe('EAS identifier scheme for Slovak Peppol network (e.g. 0245)'),
  supplierPartyName: z.string().describe('Supplier company name'),
  supplierStreet: z.string().describe('Supplier street'),
  supplierCity: z.string().describe('Supplier city'),
  supplierPostalCode: z.string().describe('Supplier postal code'),
  supplierCountryCode: z.string().describe('Supplier country code, e.g. SK'),
  supplierCompanyId: z.string().describe('Supplier IČO'),
  supplierTaxId: z.string().describe('Supplier IČ DPH with prefix, e.g. SK2020123456'),
  supplierVatId: z.string().nullable().describe('Supplier DIČ'),
  customerEndpointId: z.string().describe('Customer Peppol ID'),
  customerEndpointSchemeId: z.string().describe('Customer endpoint EAS scheme (e.g. 0245)'),
  customerPartyName: z.string().describe('Customer company name'),
  customerStreet: z.string().describe('Customer street'),
  customerCity: z.string().describe('Customer city'),
  customerPostalCode: z.string().describe('Customer postal code'),
  customerCountryCode: z.string().describe('Customer country code'),
  customerCompanyId: z.string().nullable().describe('Customer IČO'),
  customerTaxId: z.string().nullable().describe('Customer IČ DPH'),
  paymentMeansCode: z.string().describe('Payment means code: 30=bank transfer, 58=SEPA'),
  paymentId: z.string().nullable().describe('Variable symbol / payment reference'),
  iban: z.string().nullable().describe('IBAN'),
  bic: z.string().nullable().describe('SWIFT/BIC'),
  taxSubtotals: z.array(peppolTaxSubtotalSchema).describe('Tax breakdown by category'),
  taxAmountTotal: z.number().describe('Total tax amount'),
  lineExtensionAmountTotal: z.number().describe('Sum of all line net amounts'),
  taxExclusiveAmount: z.number().describe('Total without VAT'),
  taxInclusiveAmount: z.number().describe('Total with VAT'),
  payableAmount: z.number().describe('Amount to pay'),
  allowanceTotalAmount: z.number().default(0).describe('Sum of all document-level allowances'),
  chargeTotalAmount: z.number().default(0).describe('Sum of all document-level charges'),
  documentAllowances: z.array(z.object({
    amount: z.number(),
    reason: z.string(),
    reasonCode: z.string().default('95'),
    taxCategoryId: z.string(),
    taxPercent: z.number(),
    isCharge: z.boolean().default(false),
  })).default([]).describe('Document-level allowances (BG-20) and charges (BG-21)'),
  invoiceLines: z.array(peppolInvoiceLineSchema).describe('Invoice line items'),
  invoiceNote: z.string().nullable().describe('Free-text note on invoice'),
  deliveryDate: z.string().nullable().describe('Delivery date if different from issue date'),
  // Correction fields
  billingReferenceNumber: z.string().nullable().default(null).describe('Original invoice number for credit notes (BT-25)'),
  billingReferenceDate: z.string().nullable().default(null).describe('Original invoice issue date (BT-26)'),
  // Additional supporting documents (BG-24)
  additionalDocumentReferences: z.array(z.object({
    id: z.string().describe('Document reference ID (BT-122)'),
    description: z.string().nullable().describe('Document description (BT-123)'),
    filename: z.string().describe('Attachment filename'),
    mimeCode: z.string().describe('MIME type of attachment'),
    data: z.string().describe('Base64-encoded file content (BT-125)'),
  })).default([]).describe('Embedded document attachments (BG-24)'),
})

export type PeppolInvoice = z.infer<typeof peppolInvoiceSchema>
