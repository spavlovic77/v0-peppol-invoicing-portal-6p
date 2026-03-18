import type { PeppolInvoice } from './schemas'

export interface ValidationResult {
  rule: string
  severity: 'error' | 'warning'
  message: string
  passed: boolean
  /** 'api' = confirmed by ion-docval schematron */
  source?: 'api'
}

export interface ValidationPhase {
  name: string
  description: string
  results: ValidationResult[]
  passed: boolean
  /** true when an external API confirmed this phase */
  apiConfirmed?: boolean
  /** Which validator produced this result */
  validatorName?: 'ion-docval'
}

// ============================================================
// PHASE 1: Structural / Zod validation
// ============================================================
export function validateStructure(inv: PeppolInvoice): ValidationPhase {
  const results: ValidationResult[] = []

  const check = (rule: string, condition: boolean, msg: string, severity: 'error' | 'warning' = 'error') => {
    results.push({ rule, severity, message: msg, passed: condition })
  }

  check('STRUCT-01', !!inv.invoiceId, 'Cislo faktury je povinne')
  check('STRUCT-02', !!inv.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate), 'Datum vyhotovenia musi byt vo formate YYYY-MM-DD')
  check('STRUCT-03', !!inv.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate), 'Datum splatnosti musi byt vo formate YYYY-MM-DD')
  const validCustomizationIDs = [
    'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0',
  ]
  const validProfileIDs = [
    'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    'urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0',
  ]
  check('STRUCT-04', validCustomizationIDs.includes(inv.customizationID), 'CustomizationID musi byt spravny Peppol BIS 3.0 alebo Self-Billing identifikator')
  check('STRUCT-05', validProfileIDs.includes(inv.profileID), 'ProfileID musi byt spravny')
  check('STRUCT-06', !!inv.supplierPartyName, 'Nazov dodavatela je povinny')
  check('STRUCT-07', !!inv.customerPartyName, 'Nazov odberatela je povinny')
  check('STRUCT-08', inv.invoiceLines.length > 0, 'Faktura musi mat aspon jednu polozku')
  check('STRUCT-09', !!inv.supplierEndpointId, 'Endpoint dodavatela je povinny')
  check('STRUCT-10', !!inv.customerEndpointId, 'Endpoint odberatela je povinny')
  check('STRUCT-11', !!inv.supplierCountryCode && inv.supplierCountryCode.length === 2, 'Kod krajiny dodavatela musi mat 2 znaky')
  check('STRUCT-12', !!inv.customerCountryCode && inv.customerCountryCode.length === 2, 'Kod krajiny odberatela musi mat 2 znaky')
  check('STRUCT-13', !!inv.buyerReference, 'Referencia odberatela je povinna pre Peppol')
  check('STRUCT-14', ['380', '381', '383', '384', '386', '389', '751'].includes(inv.invoiceTypeCode), 'Kod typu dokumentu musi byt platny (380, 381, 384, atd.)')
  // BR-55: For Credit Note (381) and Corrective Invoice (384), billing reference is mandatory
  const needsBillingRef = inv.invoiceTypeCode === '381' || inv.invoiceTypeCode === '384'
  check('STRUCT-15', !needsBillingRef || !!inv.billingReferenceNumber, 'Dobropis (381) a opravna faktura (384) musia mat referenciu na povodnu fakturu')

  return {
    name: 'Strukturalna validacia',
    description: 'Kontrola povinnych poli a formatov',
    results,
    passed: results.every((r) => r.severity === 'warning' || r.passed),
  }
}

// Note: EN16931 and Peppol Schematron validation is handled by ion-docval (see real-validation.ts)
