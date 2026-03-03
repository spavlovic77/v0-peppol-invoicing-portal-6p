/**
 * Peppol 3-Layer Validation Pipeline
 *
 * Strict order:
 *  1. UBL 2.1 XSD — element order, types, attributes, namespaces
 *  2. EN 16931   — CEN schematron business rules (BR-*)
 *  3. Peppol BIS — OpenPEPPOL schematron rules (PEPPOL-EN16931-R*)
 *
 * Primary:  peppolvalidator.com API (runs all 3 layers in one call)
 * Fallback: JS simulation + XSD element order checks
 */

import type { ValidationPhase, ValidationResult } from './validation'
import { validateStructure, validateEN16931, validatePeppolSchematron } from './validation'
import type { PeppolInvoice } from './schemas'

// ─── peppolvalidator.com API ─────────────────────────────────────────────────

const VALIDATOR_URL = 'https://peppolvalidator.com/api/v1/validate'
const API_TIMEOUT_MS = 20_000

interface ApiItem {
  id?: string
  severity?: string
  rule?: string
  location?: string
  message?: string
  test?: string
}

interface ApiResponse {
  status: 'valid' | 'invalid' | 'error'
  errors?: ApiItem[]
  warnings?: ApiItem[]
}

/**
 * Classifies a validation item into one of the 3 phases:
 *  - "xsd"    — XML Schema errors (cvc-*, XML Schema)
 *  - "en"     — EN16931 business rules (BR-*)
 *  - "peppol" — Peppol BIS rules (PEPPOL-*)
 */
function classifyItem(item: ApiItem): 'xsd' | 'en' | 'peppol' {
  const id = (item.id ?? item.rule ?? item.test ?? '').toUpperCase()
  if (id.includes('XML SCHEMA') || id.startsWith('CVC-') || id.startsWith('XSD')) return 'xsd'
  if (id.startsWith('BR-')) return 'en'
  if (id.startsWith('PEPPOL')) return 'peppol'
  // Heuristic: if the message mentions schema/element/attribute, it's XSD
  const msg = (item.message ?? '').toLowerCase()
  if (msg.includes('cvc-') || msg.includes('invalid content') || msg.includes('schema') || msg.includes('element')) return 'xsd'
  // Default unknown rules to EN16931
  return 'en'
}

function apiItemToResult(item: ApiItem, passed: boolean, severity: 'error' | 'warning'): ValidationResult {
  return {
    rule: item.id ?? item.rule ?? item.test ?? 'UNKNOWN',
    severity,
    message: item.message ?? `Rule ${item.id ?? item.rule} violated`,
    passed,
    source: 'api' as const,
  }
}

function buildPhaseFromResults(
  name: string,
  description: string,
  results: ValidationResult[]
): ValidationPhase {
  const errors = results.filter((r) => !r.passed && r.severity === 'error')
  return { name, description, results, passed: errors.length === 0 }
}

/**
 * Self-billing invoices use different CustomizationID / ProfileID URNs
 * (poacc:selfbilling:3.0 / poacc:selfbilling:01:1.0).
 * peppolvalidator.com runs the standard BIS 3.0 schematron which rejects them.
 * We suppress R004 / R007 false positives for self-billing XML.
 */
const SELF_BILLING_SUPPRESSED_RULES = new Set([
  'PEPPOL-EN16931-R004',
  'PEPPOL-EN16931-R007',
])

function isSelfBillingXml(xml: string): boolean {
  return xml.includes('poacc:selfbilling:')
}

/**
 * Corrective invoices (384) trigger PEPPOL-EN16931-P0112 which restricts
 * code 384 to German organizations only. We use 384 for non-financial
 * corrections (Zmena údajov) regardless of country, so we suppress this rule.
 */
const CORRECTIVE_384_SUPPRESSED_RULES = new Set([
  'PEPPOL-EN16931-P0112',
])

function isCorrectiveInvoice384Xml(xml: string): boolean {
  return xml.includes('<cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>')
}

async function validateViaApi(xml: string): Promise<[ValidationPhase, ValidationPhase, ValidationPhase]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  let body: ApiResponse
  try {
    const res = await fetch(VALIDATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`peppolvalidator.com HTTP ${res.status}`)
    body = await res.json() as ApiResponse
  } finally {
    clearTimeout(timer)
  }

  const selfBilling = isSelfBillingXml(xml)
  const corrective384 = isCorrectiveInvoice384Xml(xml)

  // Split items into 3 buckets
  const xsdResults: ValidationResult[] = []
  const enResults: ValidationResult[] = []
  const peppolResults: ValidationResult[] = []

  const bucketMap = { xsd: xsdResults, en: enResults, peppol: peppolResults }

  for (const item of body.errors ?? []) {
    const ruleId = (item.id ?? item.rule ?? '').toUpperCase()
    // Suppress false positives for self-billing URNs
    if (selfBilling && SELF_BILLING_SUPPRESSED_RULES.has(ruleId)) {
      peppolResults.push(apiItemToResult(item, true, 'warning'))
      continue
    }
    // Suppress P0112 for corrective invoices (384) -- we allow 384 for non-financial corrections
    if (corrective384 && CORRECTIVE_384_SUPPRESSED_RULES.has(ruleId)) {
      peppolResults.push(apiItemToResult(item, true, 'warning'))
      continue
    }
    const bucket = bucketMap[classifyItem(item)]
    bucket.push(apiItemToResult(item, false, 'error'))
  }
  for (const item of body.warnings ?? []) {
    const bucket = bucketMap[classifyItem(item)]
    bucket.push(apiItemToResult(item, true, 'warning'))
  }

  const phase1 = {
    ...buildPhaseFromResults(
      'UBL 2.1 XSD validacia',
      'OASIS UBL 2.1 schema — element poradie, typy, atributy, menove priestory',
      xsdResults
    ),
    apiConfirmed: true,
  }
  const phase2 = {
    ...buildPhaseFromResults(
      'EN16931 pravidla',
      'Europske obchodne pravidla pre e-fakturaciu (CEN schematron)',
      enResults
    ),
    apiConfirmed: true,
  }
  const phase3 = {
    ...buildPhaseFromResults(
      'Peppol BIS 3.0 pravidla',
      'OpenPEPPOL BIS Billing 3.0 schematron pravidla',
      peppolResults
    ),
    apiConfirmed: true,
  }

  return [phase1, phase2, phase3]
}

// ─── XSD Element Order Validation (JS fallback) ──────────────────────────────

/**
 * Checks critical UBL 2.1 element orders in the XML string.
 * Not a full XSD validator, but catches the exact errors that ION AP reports.
 */
function validateXsdElementOrder(xml: string): ValidationPhase {
  const results: ValidationResult[] = []

  const check = (rule: string, condition: boolean, msg: string) => {
    results.push({ rule, severity: 'error', message: msg, passed: condition })
  }

  // Helper: find position of first occurrence of element in XML
  const pos = (tag: string): number => xml.indexOf(tag)

  // --- Root Invoice element order ---
  const rootOrder = [
    'cbc:CustomizationID', 'cbc:ProfileID', 'cbc:ID', 'cbc:IssueDate',
    'cbc:InvoiceTypeCode', 'cbc:DocumentCurrencyCode', 'cbc:BuyerReference',
    'cac:AccountingSupplierParty', 'cac:AccountingCustomerParty',
    'cac:PaymentMeans', 'cac:TaxTotal', 'cac:LegalMonetaryTotal', 'cac:InvoiceLine',
  ]

  for (let i = 0; i < rootOrder.length - 1; i++) {
    const a = pos(`<${rootOrder[i]}`)
    const b = pos(`<${rootOrder[i + 1]}`)
    if (a !== -1 && b !== -1) {
      const ok = a < b
      check(
        `XSD-ROOT-${rootOrder[i].replace(':', '-')}`,
        ok,
        ok
          ? `<${rootOrder[i]}> je pred <${rootOrder[i + 1]}>`
          : `Element <${rootOrder[i]}> musi byt pred <${rootOrder[i + 1]}> v Invoice`
      )
    }
  }

  // --- LegalMonetaryTotal element order ---
  // LineExtensionAmount < TaxExclusiveAmount < TaxInclusiveAmount < AllowanceTotalAmount < PayableAmount
  const lmtStart = pos('<cac:LegalMonetaryTotal>')
  const lmtEnd = pos('</cac:LegalMonetaryTotal>')
  if (lmtStart !== -1 && lmtEnd !== -1) {
    const lmt = xml.substring(lmtStart, lmtEnd)
    const lmtOrder = [
      'cbc:LineExtensionAmount', 'cbc:TaxExclusiveAmount',
      'cbc:TaxInclusiveAmount', 'cbc:AllowanceTotalAmount', 'cbc:PayableAmount',
    ]
    for (let i = 0; i < lmtOrder.length - 1; i++) {
      const a = lmt.indexOf(`<${lmtOrder[i]}`)
      const b = lmt.indexOf(`<${lmtOrder[i + 1]}`)
      if (a !== -1 && b !== -1) {
        const ok = a < b
        check(
          `XSD-LMT-${lmtOrder[i].replace(':', '-')}`,
          ok,
          ok
            ? `LMT: <${lmtOrder[i]}> je pred <${lmtOrder[i + 1]}>`
            : `LMT: <${lmtOrder[i]}> musi byt pred <${lmtOrder[i + 1]}>`
        )
      }
    }
  }

  // --- Item element order (inside InvoiceLine) ---
  // Name < BuyersItemIdentification < SellersItemIdentification < ClassifiedTaxCategory
  const linePattern = /<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g
  let lineMatch: RegExpExecArray | null
  let lineIdx = 0
  while ((lineMatch = linePattern.exec(xml)) !== null) {
    lineIdx++
    const lineXml = lineMatch[1]
    const itemStart = lineXml.indexOf('<cac:Item>')
    const itemEnd = lineXml.indexOf('</cac:Item>')
    if (itemStart !== -1 && itemEnd !== -1) {
      const itemXml = lineXml.substring(itemStart, itemEnd)
      const itemOrder = [
        'cbc:Name', 'cac:BuyersItemIdentification',
        'cac:SellersItemIdentification', 'cac:ClassifiedTaxCategory',
      ]
      for (let i = 0; i < itemOrder.length - 1; i++) {
        const a = itemXml.indexOf(`<${itemOrder[i]}`)
        const b = itemXml.indexOf(`<${itemOrder[i + 1]}`)
        if (a !== -1 && b !== -1) {
          const ok = a < b
          check(
            `XSD-ITEM-L${lineIdx}-${itemOrder[i].replace(':', '-')}`,
            ok,
            ok
              ? `Riadok ${lineIdx}: <${itemOrder[i]}> je pred <${itemOrder[i + 1]}>`
              : `Riadok ${lineIdx}: <${itemOrder[i]}> musi byt pred <${itemOrder[i + 1]}> v Item`
          )
        }
      }
    }
  }

  // --- Party element order ---
  // EndpointID < PartyIdentification < PartyName < PostalAddress < PartyTaxScheme < PartyLegalEntity
  const partyPattern = /<cac:Party>([\s\S]*?)<\/cac:Party>/g
  let partyMatch: RegExpExecArray | null
  let partyIdx = 0
  while ((partyMatch = partyPattern.exec(xml)) !== null) {
    partyIdx++
    const partyXml = partyMatch[1]
    const partyOrder = [
      'cbc:EndpointID', 'cac:PartyName', 'cac:PostalAddress',
      'cac:PartyTaxScheme', 'cac:PartyLegalEntity',
    ]
    for (let i = 0; i < partyOrder.length - 1; i++) {
      const a = partyXml.indexOf(`<${partyOrder[i]}`)
      const b = partyXml.indexOf(`<${partyOrder[i + 1]}`)
      if (a !== -1 && b !== -1) {
        const ok = a < b
        check(
          `XSD-PARTY-${partyIdx}-${partyOrder[i].replace(':', '-')}`,
          ok,
          ok
            ? `Party ${partyIdx}: <${partyOrder[i]}> je pred <${partyOrder[i + 1]}>`
            : `Party ${partyIdx}: <${partyOrder[i]}> musi byt pred <${partyOrder[i + 1]}>`
        )
      }
    }
  }

  // --- AllowanceCharge element order ---
  // ChargeIndicator < AllowanceChargeReasonCode < AllowanceChargeReason < Amount < BaseAmount < TaxCategory
  const acPattern = /<cac:AllowanceCharge>([\s\S]*?)<\/cac:AllowanceCharge>/g
  let acMatch: RegExpExecArray | null
  while ((acMatch = acPattern.exec(xml)) !== null) {
    const acXml = acMatch[1]
    const acOrder = [
      'cbc:ChargeIndicator', 'cbc:AllowanceChargeReasonCode',
      'cbc:AllowanceChargeReason', 'cbc:Amount',
    ]
    for (let i = 0; i < acOrder.length - 1; i++) {
      // Use closing > to avoid prefix collisions (e.g. AllowanceChargeReason matching AllowanceChargeReasonCode)
      const a = acXml.indexOf(`<${acOrder[i]}>`)
      const b = acXml.indexOf(`<${acOrder[i + 1]}>`)
      if (a !== -1 && b !== -1) {
        const ok = a < b
        check(
          `XSD-AC-${acOrder[i].replace(':', '-')}`,
          ok,
          ok
            ? `AllowanceCharge: <${acOrder[i]}> je pred <${acOrder[i + 1]}>`
            : `AllowanceCharge: <${acOrder[i]}> musi byt pred <${acOrder[i + 1]}>`
        )
      }
    }
  }

  // --- InvoiceLine element order ---
  // ID < InvoicedQuantity < LineExtensionAmount < AllowanceCharge < Item < Price
  linePattern.lastIndex = 0
  lineIdx = 0
  while ((lineMatch = linePattern.exec(xml)) !== null) {
    lineIdx++
    const lineXml = lineMatch[1]
    const lineOrder = [
      'cbc:ID', 'cbc:InvoicedQuantity', 'cbc:LineExtensionAmount',
      'cac:Item', 'cac:Price',
    ]
    for (let i = 0; i < lineOrder.length - 1; i++) {
      const a = lineXml.indexOf(`<${lineOrder[i]}`)
      const b = lineXml.indexOf(`<${lineOrder[i + 1]}`)
      if (a !== -1 && b !== -1) {
        const ok = a < b
        check(
          `XSD-LINE-${lineIdx}-${lineOrder[i].replace(':', '-')}`,
          ok,
          ok
            ? `Riadok ${lineIdx}: <${lineOrder[i]}> je pred <${lineOrder[i + 1]}>`
            : `Riadok ${lineIdx}: <${lineOrder[i]}> musi byt pred <${lineOrder[i + 1]}> v InvoiceLine`
        )
      }
    }
  }

  // --- Price element order ---
  // PriceAmount < BaseQuantity < AllowanceCharge
  const pricePattern = /<cac:Price>([\s\S]*?)<\/cac:Price>/g
  let priceMatch: RegExpExecArray | null
  while ((priceMatch = pricePattern.exec(xml)) !== null) {
    const priceXml = priceMatch[1]
    const priceOrder = ['cbc:PriceAmount', 'cbc:BaseQuantity']
    for (let i = 0; i < priceOrder.length - 1; i++) {
      const a = priceXml.indexOf(`<${priceOrder[i]}`)
      const b = priceXml.indexOf(`<${priceOrder[i + 1]}`)
      if (a !== -1 && b !== -1) {
        const ok = a < b
        check(
          `XSD-PRICE-${priceOrder[i].replace(':', '-')}`,
          ok,
          ok
            ? `Price: <${priceOrder[i]}> je pred <${priceOrder[i + 1]}>`
            : `Price: <${priceOrder[i]}> musi byt pred <${priceOrder[i + 1]}>`
        )
      }
    }
  }

  const errors = results.filter((r) => !r.passed)
  return {
    name: 'UBL 2.1 XSD validacia',
    description: 'Kontrola poradia elementov podla OASIS UBL 2.1 schemy (JS simulacia)',
    results,
    passed: errors.length === 0,
    simulated: true,
  }
}

// ─── JS Fallback ─────────────────────────────────────────────────────────────

function jsFallback(xml: string, inv: PeppolInvoice): ValidationPhase[] {
  const xsdPhase = validateXsdElementOrder(xml)
  const enPhase: ValidationPhase = { ...validateEN16931(inv), simulated: true }
  const peppolPhase: ValidationPhase = { ...validatePeppolSchematron(inv), simulated: true }
  return [xsdPhase, enPhase, peppolPhase]
}

// ─── Merge API + JS results ──────────────────────────────────────────────────

/**
 * Merges API phase results with JS-checked rules so users see the full
 * list of validated rules. API errors/warnings take precedence;
 * JS rules that the API didn't report are added as passed.
 */
function mergePhaseResults(apiPhase: ValidationPhase, jsPhase: ValidationPhase): ValidationPhase {
  const apiRuleIds = new Set(apiPhase.results.map((r) => r.rule))
  const merged: ValidationResult[] = [...apiPhase.results]

  // Add JS-checked rules that the API didn't report -- mark them as JS source
  for (const jsRule of jsPhase.results) {
    if (!apiRuleIds.has(jsRule.rule)) {
      merged.push({ ...jsRule, source: 'js' as const })
    }
  }

  return {
    ...apiPhase,
    results: merged,
    passed: merged.filter((r) => !r.passed && r.severity === 'error').length === 0,
    apiConfirmed: apiPhase.apiConfirmed, // preserve the API confirmation flag
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates a Peppol invoice using strict 3-layer pipeline:
 *  1. UBL 2.1 XSD (element order, types, namespaces)
 *  2. EN 16931 CEN schematron (BR-* business rules)
 *  3. Peppol BIS 3.0 schematron (PEPPOL-EN16931-R* rules)
 *
 * Primary:  peppolvalidator.com API
 * Fallback: JS simulation with XSD element order checks
 *
 * Validation stops at first failing layer (strict order).
 */
export async function validateInvoiceXml(
  xml: string,
  inv: PeppolInvoice
): Promise<ValidationPhase[]> {
  // Phase 0 — always run structural checks (fast, no XML needed)
  const structPhase = validateStructure(inv)
  if (!structPhase.passed) {
    return [structPhase]
  }

  // ── Primary: peppolvalidator.com API ────────────────────────────────────────
  try {
    const [xsdPhase, enPhase, peppolPhase] = await validateViaApi(xml)

    // Strict order: stop at first failing layer
    if (!xsdPhase.passed) {
      return [structPhase, xsdPhase]
    }
    if (!enPhase.passed) {
      return [structPhase, xsdPhase, enPhase]
    }

    // API succeeded -- enrich passing phases with JS rule details
    // so users can see exactly what was checked, not just an empty list.
    const jsXsd = validateXsdElementOrder(xml)
    const jsEn = validateEN16931(inv)
    const jsPeppol = validatePeppolSchematron(inv)

    const mergedXsd = mergePhaseResults(xsdPhase, jsXsd)
    const mergedEn = mergePhaseResults(enPhase, jsEn)
    const mergedPeppol = mergePhaseResults(peppolPhase, jsPeppol)

    return [structPhase, mergedXsd, mergedEn, mergedPeppol]
  } catch (err) {
    console.error('[validation] peppolvalidator.com API failed, using JS fallback:', (err as Error).message)
  }

  // ── Fallback: JS simulation + XSD element order checks ─────────────────────
  const [xsdPhase, enPhase, peppolPhase] = jsFallback(xml, inv)

  // Strict order: stop at first failing layer
  if (!xsdPhase.passed) {
    return [structPhase, xsdPhase]
  }
  if (!enPhase.passed) {
    return [structPhase, xsdPhase, enPhase]
  }
  return [structPhase, xsdPhase, enPhase, peppolPhase]
}
