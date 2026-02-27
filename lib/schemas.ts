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
})

export type CompanyProfile = z.infer<typeof companyProfileSchema>

// Invoice item schema
export const invoiceItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1, 'Popis polozky je povinny'),
  quantity: z.number().positive('Mnozstvo musi byt kladne'),
  unit: z.string().default('C62'),
  unit_price: z.number().min(0, 'Jednotkova cena nesmie byt zaporna'),
  vat_category: z.string().default('S'),
  vat_rate: z.number().min(0).max(100).default(20),
  line_total: z.number(),
  item_number: z.string().nullable(),
  buyer_item_number: z.string().nullable(),
})

export type InvoiceItem = z.infer<typeof invoiceItemSchema>

// Invoice schema
export const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Cislo faktury je povinne'),
  issue_date: z.string().min(1, 'Datum vystavenia je povinny'),
  due_date: z.string().min(1, 'Datum splatnosti je povinny'),
  delivery_date: z.string().nullable(),
  currency: z.string().default('EUR'),
  buyer_ico: z.string().nullable(),
  buyer_dic: z.string().nullable(),
  buyer_ic_dph: z.string().nullable(),
  buyer_name: z.string().min(1, 'Nazov odberatela je povinny'),
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
  items: z.array(invoiceItemSchema).min(1, 'Faktura musi mat aspon jednu polozku'),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

// Peppol UBL Invoice structured output schema (for AI generation)
export const peppolInvoiceLineSchema = z.object({
  id: z.string().describe('Line ID (sequential number)'),
  invoicedQuantity: z.number().describe('Quantity of items'),
  unitCode: z.string().describe('UN/ECE rec 20 unit code, e.g. C62 for unit, HUR for hour'),
  lineExtensionAmount: z.number().describe('Line net amount = quantity * price'),
  itemName: z.string().describe('Item name/description'),
  classifiedTaxCategoryId: z.string().describe('Tax category: S=standard, Z=zero, E=exempt, AE=reverse charge'),
  taxPercent: z.number().describe('VAT percentage, e.g. 20 for 20%'),
  priceAmount: z.number().describe('Price per unit without VAT'),
  sellersItemIdentification: z.string().nullable().describe('Seller item number'),
  buyersItemIdentification: z.string().nullable().describe('Buyer item number'),
})

export const peppolTaxSubtotalSchema = z.object({
  taxableAmount: z.number().describe('Sum of line amounts for this tax category'),
  taxAmount: z.number().describe('Tax amount for this category'),
  taxCategoryId: z.string().describe('Tax category code'),
  taxPercent: z.number().describe('Tax rate percentage'),
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
  supplierEndpointId: z.string().describe('Supplier Peppol ID, format: DIC number'),
  supplierEndpointSchemeId: z.string().describe('Always "0245" for Slovakia'),
  supplierPartyName: z.string().describe('Supplier company name'),
  supplierStreet: z.string().describe('Supplier street'),
  supplierCity: z.string().describe('Supplier city'),
  supplierPostalCode: z.string().describe('Supplier postal code'),
  supplierCountryCode: z.string().describe('Supplier country code, e.g. SK'),
  supplierCompanyId: z.string().describe('Supplier ICO'),
  supplierTaxId: z.string().describe('Supplier IC DPH with prefix, e.g. SK2020123456'),
  supplierVatId: z.string().nullable().describe('Supplier DIC'),
  customerEndpointId: z.string().describe('Customer Peppol ID'),
  customerEndpointSchemeId: z.string().describe('Customer endpoint scheme, e.g. 0245'),
  customerPartyName: z.string().describe('Customer company name'),
  customerStreet: z.string().describe('Customer street'),
  customerCity: z.string().describe('Customer city'),
  customerPostalCode: z.string().describe('Customer postal code'),
  customerCountryCode: z.string().describe('Customer country code'),
  customerCompanyId: z.string().nullable().describe('Customer ICO'),
  customerTaxId: z.string().nullable().describe('Customer IC DPH'),
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
  invoiceLines: z.array(peppolInvoiceLineSchema).describe('Invoice line items'),
  invoiceNote: z.string().nullable().describe('Free-text note on invoice'),
  deliveryDate: z.string().nullable().describe('Delivery date if different from issue date'),
})

export type PeppolInvoice = z.infer<typeof peppolInvoiceSchema>
