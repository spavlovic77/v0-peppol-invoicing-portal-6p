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
  return n.toFixed(2)
}

// BT-146 Item net price: allow up to 5 decimal places so prices like
// 0.12345 survive the round-trip. Strip unnecessary trailing zeros.
function priceAmt(n: number): string {
  return parseFloat(n.toFixed(5)).toString()
}

// Strip scheme prefix (e.g. "0245:") from endpoint IDs to avoid duplication with schemeID attr
function stripEndpointScheme(id: string | null | undefined): string {
  if (!id) return ''
  return id.replace(/^\d{4}:/, '')
}

// Render a line-level <cac:AllowanceCharge> (no <cac:TaxCategory> child per BIS 3).
function renderLineAllowanceCharge(
  currency: string,
  isCharge: boolean,
  ac: { amount: number; reasonCode: string; reason: string | null; baseAmount: number | null; multiplierFactor: number | null }
): string {
  const multiplierLine = ac.multiplierFactor !== null
    ? `\n        <cbc:MultiplierFactorNumeric>${ac.multiplierFactor}</cbc:MultiplierFactorNumeric>`
    : ''
  const baseAmountLine = ac.baseAmount !== null
    ? `\n        <cbc:BaseAmount currencyID="${escapeXml(currency)}">${amount(ac.baseAmount)}</cbc:BaseAmount>`
    : ''
  const reasonLine = ac.reason
    ? `\n        <cbc:AllowanceChargeReason>${escapeXml(ac.reason)}</cbc:AllowanceChargeReason>`
    : ''
  return `
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>${isCharge ? 'true' : 'false'}</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReasonCode>${escapeXml(ac.reasonCode)}</cbc:AllowanceChargeReasonCode>${reasonLine}${multiplierLine}
        <cbc:Amount currencyID="${escapeXml(currency)}">${amount(ac.amount)}</cbc:Amount>${baseAmountLine}
      </cac:AllowanceCharge>`
}

export function buildUblXml(inv: PeppolInvoice): string {
  const lines = inv.invoiceLines
    .map(
      (line) => {
        const lineAllowanceXml = line.lineAllowance
          ? renderLineAllowanceCharge(inv.documentCurrencyCode, false, line.lineAllowance)
          : ''
        const lineChargeXml = line.lineCharge
          ? renderLineAllowanceCharge(inv.documentCurrencyCode, true, line.lineCharge)
          : ''
        const baseQuantityXml = line.baseQuantity && line.baseQuantity !== 1
          ? `\n        <cbc:BaseQuantity unitCode="${escapeXml(line.unitCode)}">${line.baseQuantity}</cbc:BaseQuantity>`
          : ''
        return `<cac:InvoiceLine>
      <cbc:ID>${escapeXml(line.id)}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode)}">${line.invoicedQuantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(line.lineExtensionAmount)}</cbc:LineExtensionAmount>${lineAllowanceXml}${lineChargeXml}
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
        <cbc:PriceAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${priceAmt(line.priceAmount)}</cbc:PriceAmount>${baseQuantityXml}
      </cac:Price>
    </cac:InvoiceLine>`
      }
    )
    .join('\n  ')

  const taxSubtotals = inv.taxSubtotals
    .map(
      (ts) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(ts.taxCategoryId)}</cbc:ID>
        <cbc:Percent>${ts.taxPercent}</cbc:Percent>${ts.taxExemptionReasonCode ? `
        <cbc:TaxExemptionReasonCode>${escapeXml(ts.taxExemptionReasonCode)}</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>${escapeXml(ts.taxExemptionReason)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
    )
    .join('\n    ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${escapeXml(inv.customizationID)}</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(inv.profileID)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(inv.invoiceId)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(inv.issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${escapeXml(inv.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${escapeXml(inv.invoiceTypeCode)}</cbc:InvoiceTypeCode>
  ${inv.invoiceNote ? `<cbc:Note>${escapeXml(inv.invoiceNote)}</cbc:Note>\n  ` : ''}${inv.deliveryDate ? `<cbc:TaxPointDate>${escapeXml(inv.deliveryDate)}</cbc:TaxPointDate>\n  ` : ''}<cbc:DocumentCurrencyCode>${escapeXml(inv.documentCurrencyCode)}</cbc:DocumentCurrencyCode>
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
      <cac:PostalAddress>${inv.supplierStreet ? `
        <cbc:StreetName>${escapeXml(inv.supplierStreet)}</cbc:StreetName>` : ''}${inv.supplierCity ? `
        <cbc:CityName>${escapeXml(inv.supplierCity)}</cbc:CityName>` : ''}${inv.supplierPostalCode ? `
        <cbc:PostalZone>${escapeXml(inv.supplierPostalCode)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(inv.supplierCountryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${inv.supplierTaxId ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(inv.supplierTaxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(inv.supplierPartyName)}</cbc:RegistrationName>${inv.supplierCompanyId ? `
        <cbc:CompanyID>${escapeXml(inv.supplierCompanyId)}</cbc:CompanyID>` : ''}${inv.supplierLegalForm ? `
        <cbc:CompanyLegalForm>${escapeXml(inv.supplierLegalForm)}</cbc:CompanyLegalForm>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${escapeXml(inv.customerEndpointSchemeId)}">${escapeXml(stripEndpointScheme(inv.customerEndpointId))}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(inv.customerPartyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>${inv.customerStreet ? `
        <cbc:StreetName>${escapeXml(inv.customerStreet)}</cbc:StreetName>` : ''}${inv.customerCity ? `
        <cbc:CityName>${escapeXml(inv.customerCity)}</cbc:CityName>` : ''}${inv.customerPostalCode ? `
        <cbc:PostalZone>${escapeXml(inv.customerPostalCode)}</cbc:PostalZone>` : ''}
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
      inv.paymentId && inv.paymentId.trim()
        ? `
    <cbc:PaymentID>${escapeXml(inv.paymentId)}</cbc:PaymentID>`
        : ''
    }${
      inv.iban && inv.iban.trim()
        ? `
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(inv.iban)}</cbc:ID>${
          inv.bic && inv.bic.trim()
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
    <cbc:AllowanceChargeReasonCode>${escapeXml(a.reasonCode || (a.isCharge ? 'FC' : '95'))}</cbc:AllowanceChargeReasonCode>${a.reason ? `
    <cbc:AllowanceChargeReason>${escapeXml(a.reason)}</cbc:AllowanceChargeReason>` : ''}${a.multiplierFactor !== null && a.multiplierFactor !== undefined ? `
    <cbc:MultiplierFactorNumeric>${a.multiplierFactor}</cbc:MultiplierFactorNumeric>` : ''}
    <cbc:Amount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(a.amount)}</cbc:Amount>${a.baseAmount !== null && a.baseAmount !== undefined ? `
    <cbc:BaseAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(a.baseAmount)}</cbc:BaseAmount>` : ''}
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
</Invoice>`
}
