import type { PeppolInvoice } from './schemas'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ValidationResult {
  rule: string
  severity: 'error' | 'warning'
  message: string
  passed: boolean
}

export interface ValidationPhase {
  name: string
  description: string
  results: ValidationResult[]
  passed: boolean
  /** true when results come from JS simulation, not real schematron */
  simulated?: boolean
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
  check('STRUCT-02', !!inv.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate), 'Datum vystavenia musi byt vo formate YYYY-MM-DD')
  check('STRUCT-03', !!inv.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate), 'Datum splatnosti musi byt vo formate YYYY-MM-DD')
  check('STRUCT-04', inv.customizationID === 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0', 'CustomizationID musi byt spravny Peppol BIS 3.0 identifikator')
  check('STRUCT-05', inv.profileID === 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0', 'ProfileID musi byt spravny')
  check('STRUCT-06', !!inv.supplierPartyName, 'Nazov dodavatela je povinny')
  check('STRUCT-07', !!inv.customerPartyName, 'Nazov odberatela je povinny')
  check('STRUCT-08', inv.invoiceLines.length > 0, 'Faktura musi mat aspon jednu polozku')
  check('STRUCT-09', !!inv.supplierEndpointId, 'Endpoint dodavatela je povinny')
  check('STRUCT-10', !!inv.customerEndpointId, 'Endpoint odberatela je povinny')
  check('STRUCT-11', !!inv.supplierCountryCode && inv.supplierCountryCode.length === 2, 'Kod krajiny dodavatela musi mat 2 znaky')
  check('STRUCT-12', !!inv.customerCountryCode && inv.customerCountryCode.length === 2, 'Kod krajiny odberatela musi mat 2 znaky')
  check('STRUCT-13', !!inv.buyerReference, 'Referencia odberatela je povinna pre Peppol')
  check('STRUCT-14', ['380', '381', '383', '386', '389', '751'].includes(inv.invoiceTypeCode), 'Kod typu dokumentu musi byt platny (380, 381, atd.)')

  return {
    name: 'Strukturalna validacia',
    description: 'Kontrola povinnych poli a formatov',
    results,
    passed: results.every((r) => r.severity === 'warning' || r.passed),
  }
}

// ============================================================
// PHASE 2: EN16931 Business Rules
// ============================================================
export function validateEN16931(inv: PeppolInvoice): ValidationPhase {
  const results: ValidationResult[] = []

  const check = (rule: string, condition: boolean, msg: string, severity: 'error' | 'warning' = 'error') => {
    results.push({ rule, severity, message: msg, passed: condition })
  }

  // BR-01: An Invoice shall have a Specification identifier
  check('BR-01', !!inv.customizationID, 'Faktura musi mat identifikator specifikacie')

  // BR-02: An Invoice shall have an Invoice number
  check('BR-02', !!inv.invoiceId, 'Faktura musi mat cislo faktury')

  // BR-03: An Invoice shall have an Invoice issue date
  check('BR-03', !!inv.issueDate, 'Faktura musi mat datum vystavenia')

  // BR-04: An Invoice shall have an Invoice type code
  check('BR-04', !!inv.invoiceTypeCode, 'Faktura musi mat kod typu')

  // BR-05: An Invoice shall have an Invoice currency code
  check('BR-05', !!inv.documentCurrencyCode, 'Faktura musi mat kod meny')

  // BR-06: Seller name shall be provided
  check('BR-06', !!inv.supplierPartyName, 'Nazov predavajuceho musi byt uvedeny')

  // BR-07: Buyer name shall be provided
  check('BR-07', !!inv.customerPartyName, 'Nazov kupujuceho musi byt uvedeny')

  // BR-08: Seller postal address shall contain country code
  check('BR-08', !!inv.supplierCountryCode, 'Adresa predavajuceho musi obsahovat kod krajiny')

  // BR-09: Buyer postal address shall contain country code
  check('BR-09', !!inv.customerCountryCode, 'Adresa kupujuceho musi obsahovat kod krajiny')

  // BR-10: Seller must have a legal entity
  check('BR-10', !!inv.supplierCompanyId, 'Predavajuci musi mat pravnu identifikaciu (ICO)')

  // BR-11: Seller VAT identifier (not required for non-VAT payers -- TaxCategory O)
  const allCategoryO = inv.taxSubtotals.every((ts) => ts.taxCategoryId === 'O')
  check('BR-11', allCategoryO || !!inv.supplierTaxId, 'Predavajuci musi mat danove cislo (IC DPH)')

  // BR-12: Line extension amount calculation
  const lineSum = inv.invoiceLines.reduce((s, l) => s + l.lineExtensionAmount, 0)
  check('BR-12', Math.abs(lineSum - inv.lineExtensionAmountTotal) < 0.02, `Suma riadkov (${lineSum.toFixed(2)}) sa musi rovnat celkovej sume riadkov (${inv.lineExtensionAmountTotal.toFixed(2)})`)

  // BR-13: Tax exclusive = line extension total + charges - allowances
  const expectedTaxExclusive = inv.lineExtensionAmountTotal + (inv.chargeTotalAmount || 0) - (inv.allowanceTotalAmount || 0)
  check('BR-13', Math.abs(inv.taxExclusiveAmount - expectedTaxExclusive) < 0.02, `Zaklad dane (${inv.taxExclusiveAmount.toFixed(2)}) = suma riadkov (${inv.lineExtensionAmountTotal.toFixed(2)}) + priratzky (${(inv.chargeTotalAmount || 0).toFixed(2)}) - zlavy (${(inv.allowanceTotalAmount || 0).toFixed(2)})`)

  // BR-14: Tax inclusive = tax exclusive + tax total
  check('BR-14', Math.abs(inv.taxInclusiveAmount - (inv.taxExclusiveAmount + inv.taxAmountTotal)) < 0.02, 'Suma s DPH = zaklad dane + DPH')

  // BR-15: Payable amount
  check('BR-15', Math.abs(inv.payableAmount - inv.taxInclusiveAmount) < 0.02, 'Suma na uhradu sa musi rovnat sume s DPH')

  // BR-16: Each line must have an ID
  inv.invoiceLines.forEach((line, i) => {
    check(`BR-21-L${i + 1}`, !!line.id, `Riadok ${i + 1}: musi mat ID`)
    check(`BR-22-L${i + 1}`, line.invoicedQuantity > 0, `Riadok ${i + 1}: mnozstvo musi byt kladne`)
    check(`BR-23-L${i + 1}`, !!line.itemName, `Riadok ${i + 1}: musi mat nazov polozky`)
    check(`BR-24-L${i + 1}`, line.priceAmount >= 0, `Riadok ${i + 1}: cena nesmie byt zaporna`)

    // Check line total calculation (qty * price - discount)
    const grossTotal = line.invoicedQuantity * line.priceAmount
    const discountAmt = line.allowanceChargeAmount || 0
    const expectedTotal = grossTotal - discountAmt
    check(`BR-25-L${i + 1}`, Math.abs(line.lineExtensionAmount - expectedTotal) < 0.02, `Riadok ${i + 1}: suma riadku (${line.lineExtensionAmount}) sa musi rovnat mnozstvo x cena - zlava (${expectedTotal.toFixed(2)})`)
  })

  // Tax subtotal checks -- SK reverse method may produce values that differ
  // from forward method by up to 1 cent per line item, so we use wider tolerance
  // Skip for category O (non-VAT payer) -- tax is always 0
  inv.taxSubtotals.forEach((ts, i) => {
    if (ts.taxCategoryId === 'O') {
      check(`BR-O-08-T${i + 1}`, ts.taxAmount === 0, `Danovy suctot ${i + 1}: Pre kategoriu O (nie platca DPH) musi byt DPH 0`)
      return
    }
    // SK method: tax = gross * rate / (100+rate), taxBase = gross - tax
    // Forward check: tax should approximately equal taxBase * rate / 100
    const expectedTax = round2(ts.taxableAmount * (ts.taxPercent / 100))
    // SK rounding can cause up to ~1 EUR difference on large invoices
    check(`BR-S-08-T${i + 1}`, Math.abs(ts.taxAmount - expectedTax) < 1.00, `Danovy suctot ${i + 1}: DPH (${ts.taxAmount}) ~ zaklad (${ts.taxableAmount}) x sadzba (${ts.taxPercent}%) = ${expectedTax}`)
  })

  // BR-CO-15: Tax total = sum of tax subtotals
  const taxSubtotalSum = inv.taxSubtotals.reduce((s, ts) => s + ts.taxAmount, 0)
  check('BR-CO-15', Math.abs(inv.taxAmountTotal - taxSubtotalSum) < 0.02, `Celkova DPH (${inv.taxAmountTotal.toFixed(2)}) = suma danoveho rozpisu (${taxSubtotalSum.toFixed(2)})`)

  return {
    name: 'EN16931 pravidla',
    description: 'Europske obchodne pravidla pre e-fakturaciu',
    results,
    passed: results.every((r) => r.severity === 'warning' || r.passed),
  }
}

// ============================================================
// PHASE 3: Peppol BIS Schematron Rules
// ============================================================
export function validatePeppolSchematron(inv: PeppolInvoice): ValidationPhase {
  const results: ValidationResult[] = []

  const check = (rule: string, condition: boolean, msg: string, severity: 'error' | 'warning' = 'error') => {
    results.push({ rule, severity, message: msg, passed: condition })
  }

  // PEPPOL-EN16931-R001: Business process shall be specified
  check('PEPPOL-EN16931-R001', inv.profileID === 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0', 'ProfileID musi byt "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"')

  // PEPPOL-EN16931-R002: No more than one tax subtotal per category
  const taxCatCounts = new Map<string, number>()
  inv.taxSubtotals.forEach((ts) => {
    const key = `${ts.taxCategoryId}-${ts.taxPercent}`
    taxCatCounts.set(key, (taxCatCounts.get(key) || 0) + 1)
  })
  check('PEPPOL-EN16931-R002', Array.from(taxCatCounts.values()).every((c) => c === 1), 'Maximalne jeden danovy suctot na kategoriu DPH')

  // PEPPOL-EN16931-R003: BuyerReference must be provided
  check('PEPPOL-EN16931-R003', !!inv.buyerReference, 'Referencia odberatela (BuyerReference) je povinna')

  // PEPPOL-EN16931-R004: Specification identifier must be Peppol BIS 3.0
  check('PEPPOL-EN16931-R004', inv.customizationID.includes('peppol.eu:2017:poacc:billing:3.0'), 'CustomizationID musi obsahovat Peppol BIS 3.0 identifikator')

  // PEPPOL-EN16931-R007: Buyer reference OR purchase order ref required
  check('PEPPOL-EN16931-R007', !!inv.buyerReference || !!inv.orderReferenceId, 'Musi byt uvedena referencia odberatela alebo cislo objednavky')

  // PEPPOL-EN16931-R008: Document currency code must be 3 letters
  check('PEPPOL-EN16931-R008', /^[A-Z]{3}$/.test(inv.documentCurrencyCode), 'Kod meny musi byt 3-pismenny ISO 4217 kod')

  // PEPPOL-EN16931-R010: Seller endpoint required
  check('PEPPOL-EN16931-R010', !!inv.supplierEndpointId && !!inv.supplierEndpointSchemeId, 'Elektronicky endpoint dodavatela je povinny s ID schemy')

  // PEPPOL-EN16931-R020: Buyer endpoint required
  check('PEPPOL-EN16931-R020', !!inv.customerEndpointId && !!inv.customerEndpointSchemeId, 'Elektronicky endpoint odberatela je povinny s ID schemy')

  // Payee bank account required when payment is bank transfer
  if (inv.paymentMeansCode === '30' || inv.paymentMeansCode === '58') {
    check('PEPPOL-BANK-R001', !!inv.iban, 'Pre bankovy prevod musi byt uvedeny ucet (IBAN)')
  }

  // PEPPOL-EN16931-R041: IBAN format check
  if (inv.iban) {
    check('PEPPOL-EN16931-R041', /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(inv.iban.replace(/\s/g, '')), 'IBAN musi byt v platnom formate (napr. SK89 7500 0000 0000 1234 5678)')
  }

  // PEPPOL-EN16931-R042: Payment means code must be valid
  const validPaymentMeans = ['10', '20', '30', '31', '42', '48', '49', '50', '51', '54', '55', '57', '58', '59']
  check('PEPPOL-EN16931-R042', validPaymentMeans.includes(inv.paymentMeansCode), 'Kod sposobu platby musi byt platny (30=bankovy prevod, 58=SEPA)')

  // PEPPOL-EN16931-R053: VAT category code list validation
  const validVatCats = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M']
  inv.invoiceLines.forEach((line, i) => {
    check(`PEPPOL-EN16931-R053-L${i + 1}`, validVatCats.includes(line.classifiedTaxCategoryId), `Riadok ${i + 1}: Kod kategorie DPH "${line.classifiedTaxCategoryId}" nie je platny`)
  })

  // PEPPOL-EN16931-R054: Each line item unit code validation
  const validUnits = ['C62', 'DAY', 'HUR', 'KGM', 'KTM', 'KWH', 'LS', 'LTR', 'MIN', 'MMT', 'MON', 'MTK', 'MTQ', 'MTR', 'NAR', 'NPR', 'P1', 'PCE', 'SET', 'TNE', 'XBE', 'XBX', 'XPK']
  inv.invoiceLines.forEach((line, i) => {
    check(`PEPPOL-EN16931-R130-L${i + 1}`, validUnits.includes(line.unitCode), `Riadok ${i + 1}: Kod jednotky "${line.unitCode}" nie je v povolenom zozname`, 'warning')
  })

  // PEPPOL-EN16931-R061: Tax category on invoice lines must match subtotals
  const lineTaxCats = new Set(inv.invoiceLines.map((l) => l.classifiedTaxCategoryId))
  const subtotalCats = new Set(inv.taxSubtotals.map((ts) => ts.taxCategoryId))
  lineTaxCats.forEach((cat) => {
    check(`PEPPOL-EN16931-R061-${cat}`, subtotalCats.has(cat), `Kategoria DPH "${cat}" z riadkov musi byt v danovom rozpise`)
  })

  // Endpoint scheme validation (9950 for Peppol test/ACC network)
  if (inv.supplierCountryCode === 'SK') {
    check('PEPPOL-SK-R001', inv.supplierEndpointSchemeId === '9950', 'Pre testovaci Peppol rezim musi byt schema endpointu 9950', 'warning')
  }

  // Invoice type code validation
  check('PEPPOL-EN16931-R080', ['380', '381', '383', '386', '389', '751'].includes(inv.invoiceTypeCode), 'Typ dokumentu musi byt platny (380=faktura, 381=dobropis)')

  return {
    name: 'Peppol BIS schematron pravidla',
    description: 'Specificke Peppol pravidla a kontroly zoznamov kodov',
    results,
    passed: results.every((r) => r.severity === 'warning' || r.passed),
  }
}

// ============================================================
// Full validation
// ============================================================
export function validateInvoice(inv: PeppolInvoice): ValidationPhase[] {
  return [
    validateStructure(inv),
    validateEN16931(inv),
    validatePeppolSchematron(inv),
  ]
}
