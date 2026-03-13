/**
 * Peppol 3-Layer Validation Pipeline
 *
 * Strict order:
 *  1. UBL 2.1 XSD — element order, types, attributes, namespaces
 *  2. EN 16931   — CEN schematron business rules (BR-*)
 *  3. Peppol BIS — OpenPEPPOL schematron rules (PEPPOL-EN16931-R*)
 *
 * Engine: ion-docval on Fly.io (XSD + EN16931 XSLT + Peppol Schematron)
 */

import type { ValidationPhase, ValidationResult } from './validation'
import { validateStructure } from './validation'
import type { PeppolInvoice } from './schemas'

// ─── Peppol Validator API (proxied ion-docval) ──────────────────────────────

const ION_DOCVAL_URL = process.env.PEPPOL_VALIDATOR_API_URL || 'https://peppol-validator-api.vercel.app/api/v1/validate'
const ION_DOCVAL_API_KEY = process.env.PEPPOL_VALIDATOR_API_KEY || ''
const ION_DOCVAL_API_SECRET = process.env.PEPPOL_VALIDATOR_API_SECRET || ''
const ION_DOCVAL_TIMEOUT_MS = 30_000

// ─── ion-docval types & helpers ─────────────────────────────────────────────

interface IonDocvalItem {
  test?: string
  message?: string
  line?: number
  column?: number
  location?: string
}

interface IonDocvalResponse {
  errors: IonDocvalItem[]
  warnings: IonDocvalItem[]
  error_count: number
  warning_count: number
  document_type?: string
}

/**
 * Classifies an ion-docval item into one of the 3 phases.
 * ion-docval `test` field is either "XML Schema", "Validator selection",
 * or the Schematron XPath test expression.
 * The rule ID (e.g. [BR-06]) is embedded in the `message` field.
 */
function classifyIonDocvalItem(item: IonDocvalItem): 'xsd' | 'en' | 'peppol' {
  const test = (item.test ?? '').toLowerCase()
  if (test === 'xml schema' || test === 'validator selection') return 'xsd'

  const msg = item.message ?? ''
  // Extract rule ID from message like "[BR-06]-An Invoice shall..."
  const ruleMatch = msg.match(/^\[([A-Z0-9-]+)\]/)
  if (ruleMatch) {
    const ruleId = ruleMatch[1]
    if (ruleId.startsWith('PEPPOL')) return 'peppol'
    if (ruleId.startsWith('BR')) return 'en'
  }

  // Heuristic from test expression
  if (test.includes('cvc-') || test.includes('schema')) return 'xsd'
  if (item.location?.includes('ubl-invoice:') || item.location?.includes('ubl-creditnote:')) return 'peppol'

  return 'en'
}

function ionDocvalItemToResult(item: IonDocvalItem, passed: boolean, severity: 'error' | 'warning'): ValidationResult {
  const msg = item.message ?? `Rule violated: ${item.test}`
  // Extract rule ID from message "[BR-06]-..." or use the test field
  const ruleMatch = msg.match(/^\[([A-Z0-9-]+)\]/)
  const rule = ruleMatch ? ruleMatch[1] : (item.test ?? 'UNKNOWN')

  return {
    rule,
    severity,
    message: msg,
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

// ─── ion-docval validation ──────────────────────────────────────────────────

async function validateViaIonDocval(xml: string): Promise<[ValidationPhase, ValidationPhase, ValidationPhase]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ION_DOCVAL_TIMEOUT_MS)

  let body: IonDocvalResponse
  try {
    const res = await fetch(ION_DOCVAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'X-API-Key': ION_DOCVAL_API_KEY,
        'X-API-Secret': ION_DOCVAL_API_SECRET,
      },
      body: xml,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`ion-docval HTTP ${res.status}`)
    body = await res.json() as IonDocvalResponse
  } finally {
    clearTimeout(timer)
  }

  const xsdResults: ValidationResult[] = []
  const enResults: ValidationResult[] = []
  const peppolResults: ValidationResult[] = []

  const bucketMap = { xsd: xsdResults, en: enResults, peppol: peppolResults }

  for (const item of body.errors) {
    const msg = item.message ?? ''
    const ruleMatch = msg.match(/^\[([A-Z0-9-]+)\]/)
    const ruleId = ruleMatch ? ruleMatch[1] : ''

    const bucket = bucketMap[classifyIonDocvalItem(item)]
    bucket.push(ionDocvalItemToResult(item, false, 'error'))
  }

  for (const item of body.warnings) {
    const bucket = bucketMap[classifyIonDocvalItem(item)]
    bucket.push(ionDocvalItemToResult(item, true, 'warning'))
  }

  const phase1 = {
    ...buildPhaseFromResults(
      'UBL 2.1 XSD validácia',
      'OASIS UBL 2.1 schema — element poradie, typy, atribúty, menné priestory',
      xsdResults
    ),
    apiConfirmed: true,
    validatorName: 'ion-docval' as const,
  }
  const phase2 = {
    ...buildPhaseFromResults(
      'EN16931 pravidlá',
      'EN pravidlá pre e-fakturáciu (CEN schematron)',
      enResults
    ),
    apiConfirmed: true,
    validatorName: 'ion-docval' as const,
  }
  const phase3 = {
    ...buildPhaseFromResults(
      'Peppol BIS 3.0 pravidla',
      'OpenPEPPOL BIS Billing 3.0 schematron pravidla',
      peppolResults
    ),
    apiConfirmed: true,
    validatorName: 'ion-docval' as const,
  }

  return [phase1, phase2, phase3]
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validates a Peppol invoice using strict 3-layer pipeline via ion-docval.
 * Validation stops at first failing layer (strict order).
 * If ion-docval is unreachable, returns an error phase (no fallback).
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

  // ── ion-docval on Fly.io ────────────────────────────────────────────────────
  try {
    const [xsdPhase, enPhase, peppolPhase] = await validateViaIonDocval(xml)
    console.log('[validation] ion-docval succeeded')

    // Strict order: stop at first failing layer
    if (!xsdPhase.passed) {
      return [structPhase, xsdPhase]
    }
    if (!enPhase.passed) {
      return [structPhase, xsdPhase, enPhase]
    }
    return [structPhase, xsdPhase, enPhase, peppolPhase]
  } catch (err) {
    console.error('[validation] ion-docval failed:', (err as Error).message)
  }

  // ── ion-docval unreachable — return error phase ───────────────────────────
  const errorPhase: ValidationPhase = {
    name: 'Validacia nedostupna',
    description: 'Validacny server ion-docval je momentalne nedostupny. Skuste to neskor.',
    results: [{
      rule: 'VALIDATOR-OFFLINE',
      severity: 'error',
      message: 'Nepodarilo sa pripojit k validacnemu serveru. Skontrolujte pripojenie a skuste znova.',
      passed: false,
      source: 'api' as const,
    }],
    passed: false,
  }

  return [structPhase, errorPhase]
}
