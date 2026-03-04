import type { PeppolInvoice } from './schemas'

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function amount(n: number): string {
  return Math.abs(n).toFixed(2)
}

function stripEndpointScheme(id: string | null | undefined): string {
  if (!id) return ''
  return id.replace(/^\d{4}:/, '')
}

/**
 * Builds UBL 2.1 CreditNote XML for Peppol BIS 3.0.
 * All amounts are POSITIVE (the CreditNote document type implies reversal).
 * Uses CreditNoteLine with CreditedQuantity instead of InvoiceLine/InvoicedQuantity.
 */
export function buildCreditNoteXml(inv: PeppolInvoice): string {
  const lines = inv.invoiceLines
    .map(
      (line) => `<cac:CreditNoteLine>
      <cbc:ID>${escapeXml(line.id)}</cbc:ID>
      <cbc:CreditedQuantity unitCode="${escapeXml(line.unitCode)}">${Math.abs(line.invoicedQuantity)}</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(line.lineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.itemName)}</cbc:Name>${
          line.buyersItemIdentification
            ? `
        <cac:BuyersItemIdentification>
          <cbc:ID>${escapeXml(line.buyersItemIdentification)}</cbc:ID>
        </cac:BuyersItemIdentification>`
            : ''
        }${
          line.sellersItemIdentification
            ? `
        <cac:SellersItemIdentification>
          <cbc:ID>${escapeXml(line.sellersItemIdentification)}</cbc:ID>
        </cac:SellersItemIdentification>`
            : ''
        }
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(line.classifiedTaxCategoryId)}</cbc:ID>
          <cbc:Percent>${line.taxPercent}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(line.priceAmount)}</cbc:PriceAmount>
      </cac:Price>
    </cac:CreditNoteLine>`
    )
    .join('\n  ')

  const taxSubtotals = inv.taxSubtotals
    .map(
      (ts) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(ts.taxCategoryId)}</cbc:ID>
        <cbc:Percent>${ts.taxPercent}</cbc:Percent>${ts.taxCategoryId === 'O' ? `
        <cbc:TaxExemptionReasonCode>vatex-eu-o</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Not subject to VAT</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
    )
    .join('\n    ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${escapeXml(inv.customizationID)}</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(inv.profileID)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(inv.invoiceId)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(inv.issueDate)}</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  ${inv.invoiceNote ? `<cbc:Note>${escapeXml(inv.invoiceNote)}</cbc:Note>\n  ` : ''}<cbc:DocumentCurrencyCode>${escapeXml(inv.documentCurrencyCode)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(inv.buyerReference)}</cbc:BuyerReference>
  ${inv.orderReferenceId ? `<cac:OrderReference>
    <cbc:ID>${escapeXml(inv.orderReferenceId)}</cbc:ID>
  </cac:OrderReference>\n  ` : ''}${inv.billingReferenceNumber ? `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(inv.billingReferenceNumber)}</cbc:ID>${inv.billingReferenceDate ? `
      <cbc:IssueDate>${escapeXml(inv.billingReferenceDate)}</cbc:IssueDate>` : ''}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>\n  ` : ''}${(inv.additionalDocumentReferences || []).map(doc => `<cac:AdditionalDocumentReference>
    <cbc:ID>${escapeXml(doc.id)}</cbc:ID>${doc.description ? `
    <cbc:DocumentDescription>${escapeXml(doc.description)}</cbc:DocumentDescription>` : ''}
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="${escapeXml(doc.mimeCode)}" filename="${escapeXml(doc.filename)}">${doc.data}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>\n  `).join('')}<cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${escapeXml(inv.supplierEndpointSchemeId)}">${escapeXml(stripEndpointScheme(inv.supplierEndpointId))}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(inv.supplierPartyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(inv.supplierStreet)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(inv.supplierCity)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(inv.supplierPostalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(inv.supplierCountryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(inv.supplierTaxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(inv.supplierPartyName)}</cbc:RegistrationName>
        <cbc:CompanyID>${escapeXml(inv.supplierCompanyId)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${escapeXml(inv.customerEndpointSchemeId)}">${escapeXml(stripEndpointScheme(inv.customerEndpointId))}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(inv.customerPartyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(inv.customerStreet)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(inv.customerCity)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(inv.customerPostalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(inv.customerCountryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${
        inv.customerTaxId
          ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(inv.customerTaxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ''
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(inv.customerPartyName)}</cbc:RegistrationName>${
          inv.customerCompanyId
            ? `
        <cbc:CompanyID>${escapeXml(inv.customerCompanyId)}</cbc:CompanyID>`
            : ''
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${escapeXml(inv.paymentMeansCode)}</cbc:PaymentMeansCode>${
      inv.paymentId
        ? `
    <cbc:PaymentID>${escapeXml(inv.paymentId)}</cbc:PaymentID>`
        : ''
    }${
      inv.iban
        ? `
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(inv.iban)}</cbc:ID>${
          inv.bic
            ? `
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${escapeXml(inv.bic)}</cbc:ID>
      </cac:FinancialInstitutionBranch>`
            : ''
        }
    </cac:PayeeFinancialAccount>`
        : ''
    }
  </cac:PaymentMeans>
${(inv.documentAllowances || []).filter(a => a.amount > 0).map(a => `  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>${a.isCharge ? 'true' : 'false'}</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReasonCode>${escapeXml(a.reasonCode || '95')}</cbc:AllowanceChargeReasonCode>
    <cbc:AllowanceChargeReason>${escapeXml(a.reason)}</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(a.amount)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>${escapeXml(a.taxCategoryId)}</cbc:ID>
      <cbc:Percent>${a.taxPercent}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>`).join('\n')}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxAmountTotal)}</cbc:TaxAmount>
    ${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.lineExtensionAmountTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>${
    (inv.allowanceTotalAmount || 0) > 0 ? `
    <cbc:AllowanceTotalAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.allowanceTotalAmount)}</cbc:AllowanceTotalAmount>` : ''}${
    (inv.chargeTotalAmount || 0) > 0 ? `
    <cbc:ChargeTotalAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.chargeTotalAmount)}</cbc:ChargeTotalAmount>` : ''}
    <cbc:PayableAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</CreditNote>`
}
