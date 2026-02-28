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

// Strip scheme prefix (e.g. "9950:") from endpoint IDs to avoid duplication with schemeID attr
function stripEndpointScheme(id: string | null | undefined): string {
  if (!id) return ''
  return id.replace(/^\d{4}:/, '')
}

export function buildUblXml(inv: PeppolInvoice): string {
  const lines = inv.invoiceLines
    .map(
      (line) => `
    <cac:InvoiceLine>
      <cbc:ID>${escapeXml(line.id)}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode)}">${line.invoicedQuantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(line.lineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.itemName)}</cbc:Name>${
          line.sellersItemIdentification
            ? `
        <cac:SellersItemIdentification>
          <cbc:ID>${escapeXml(line.sellersItemIdentification)}</cbc:ID>
        </cac:SellersItemIdentification>`
            : ''
        }${
          line.buyersItemIdentification
            ? `
        <cac:BuyersItemIdentification>
          <cbc:ID>${escapeXml(line.buyersItemIdentification)}</cbc:ID>
        </cac:BuyersItemIdentification>`
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
    </cac:InvoiceLine>`
    )
    .join('')

  const taxSubtotals = inv.taxSubtotals
    .map(
      (ts) => `
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxableAmount)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(ts.taxAmount)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>${escapeXml(ts.taxCategoryId)}</cbc:ID>
            <cbc:Percent>${ts.taxPercent}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>`
    )
    .join('')

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
  ${inv.invoiceNote ? `<cbc:Note>${escapeXml(inv.invoiceNote)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>${escapeXml(inv.documentCurrencyCode)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(inv.buyerReference)}</cbc:BuyerReference>
  ${inv.orderReferenceId ? `<cac:OrderReference>
    <cbc:ID>${escapeXml(inv.orderReferenceId)}</cbc:ID>
  </cac:OrderReference>` : ''}
  <cac:AccountingSupplierParty>
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
  </cac:AccountingCustomerParty>${
    inv.deliveryDate
      ? `
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${escapeXml(inv.deliveryDate)}</cbc:ActualDeliveryDate>
  </cac:Delivery>`
      : ''
  }
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
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxAmountTotal)}</cbc:TaxAmount>
    ${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.lineExtensionAmountTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escapeXml(inv.documentCurrencyCode)}">${amount(inv.payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>`
}
