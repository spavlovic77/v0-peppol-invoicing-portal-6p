/**
 * Real PEPPOL BIS 3.0 schematron validation using Saxon-JS.
 *
 * Runs the official OpenPEPPOL schematron rules against the generated UBL XML.
 * The .sef.json files are produced by: node scripts/compile-schematron.mjs
 *
 * Fallback chain (in order):
 *  1. Saxon-JS with local SEF files  — primary, runs on Vercel after prebuild
 *  2. peppolvalidator.com REST API   — when SEF files are not yet compiled
 *  3. JS-based simulation            — absolute last resort if API is unreachable
 */

import fs from 'fs'
import path from 'path'
import type { ValidationPhase, ValidationResult } from './validation'
import { validateStructure, validateEN16931, validatePeppolSchematron } from './validation'
import type { PeppolInvoice } from './schemas'

// ─── SEF file loading (cached per warm Lambda instance) ──────────────────────

const SCHEMATRON_DIR = path.join(process.cwd(), 'lib', 'schematron')

let cenSef: object | null = null
let peppolSef: object | null = null

function loadSef(name: string): object | null {
  const sefPath = path.join(SCHEMATRON_DIR, `${name}.sef.json`)
  if (!fs.existsSync(sefPath)) return null
  return JSON.parse(fs.readFileSync(sefPath, 'utf-8'))
}

function getCenSef(): object | null {
  if (cenSef === null) cenSef = loadSef('CEN-EN16931-UBL')
  return cenSef
}

function getPeppolSef(): object | null {
  if (peppolSef === null) peppolSef = loadSef('PEPPOL-EN16931-UBL')
  return peppolSef
}

// ─── SVRL parsing ─────────────────────────────────────────────────────────────

interface SvrlAssert {
  id: string
  flag: string   // "fatal" | "warning" | "error"
  location: string
  text: string
}

/**
 * Parses SVRL (Schematron Validation Report Language) XML output.
 * Extracts all <svrl:failed-assert> elements — these are the rule violations.
 */
function parseSvrl(svrlXml: string): SvrlAssert[] {
  const results: SvrlAssert[] = []
  // Match every <svrl:failed-assert ...>...</svrl:failed-assert> block
  const pattern = /<svrl:failed-assert([^>]*)>([\s\S]*?)<\/svrl:failed-assert>/g
  let m: RegExpExecArray | null

  while ((m = pattern.exec(svrlXml)) !== null) {
    const attrs   = m[1]
    const content = m[2]

    const id       = attrs.match(/\bid="([^"]*)"/)?.[1]   ?? ''
    // PEPPOL schematron uses 'flag' attribute; older ones may use 'role'
    const flag     = attrs.match(/\bflag="([^"]*)"/)?.[1] ?? attrs.match(/\brole="([^"]*)"/)?.[1] ?? 'fatal'
    const location = attrs.match(/\blocation="([^"]*)"/)?.[1] ?? ''
    // Strip any inner XML tags from the text (e.g. <svrl:diagnostic-reference>)
    const rawText  = content.match(/<svrl:text[^>]*>([\s\S]*?)<\/svrl:text>/)?.[1] ?? ''
    const text     = rawText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    results.push({ id, flag, location, text })
  }

  return results
}

// ─── Run one schematron SEF against XML ───────────────────────────────────────

async function runSchematron(xmlContent: string, sef: object): Promise<SvrlAssert[]> {
  // Dynamic import so Next.js doesn't try to bundle SaxonJS client-side
  const SaxonJS = (await import('saxon-js')).default

  const result = await SaxonJS.transform(
    {
      stylesheetInternal: sef,
      sourceText: xmlContent,
      destination: 'serialized',
    },
    'async'
  )

  return parseSvrl(result.principalResult as string)
}

// ─── Convert SVRL asserts → ValidationResult[] ───────────────────────────────

function assertsToResults(asserts: SvrlAssert[], passing: boolean): ValidationResult[] {
  return asserts.map((a) => ({
    rule:     a.id || 'UNKNOWN',
    severity: a.flag === 'warning' ? ('warning' as const) : ('error' as const),
    message:  a.text || `Rule ${a.id} violated at ${a.location}`,
    passed:   passing,
  }))
}

function buildPhase(
  name: string,
  description: string,
  asserts: SvrlAssert[]
): ValidationPhase {
  const errors   = asserts.filter((a) => a.flag !== 'warning')
  const warnings = asserts.filter((a) => a.flag === 'warning')

  const results: ValidationResult[] = [
    ...assertsToResults(errors, false),
    ...assertsToResults(warnings, true),
  ]

  // Add a synthetic "all OK" entry when there are no violations at all
  if (results.length === 0) {
    results.push({
      rule:     'OK',
      severity: 'error',
      message:  'Vsetky pravidla su splnene',
      passed:   true,
    })
  }

  return {
    name,
    description,
    results,
    passed: errors.length === 0,
  }
}

// ─── External API fallback (peppolvalidator.com) ─────────────────────────────

const EXTERNAL_VALIDATOR_URL = 'https://peppolvalidator.com/api/v1/validate'
const EXTERNAL_API_TIMEOUT_MS = 15_000

interface ExternalApiItem {
  id?: string
  severity?: string
  rule?: string
  location?: string
  message?: string
}

interface ExternalApiResponse {
  status: 'valid' | 'invalid' | 'error'
  errors?: ExternalApiItem[]
  warnings?: ExternalApiItem[]
}

/**
 * Calls peppolvalidator.com with the raw UBL XML.
 * Returns [cenPhase, peppolPhase] shaped as ValidationPhase[].
 * Throws if the API is unreachable or returns a non-2xx status.
 */
async function validateViaExternalApi(xml: string): Promise<[ValidationPhase, ValidationPhase]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS)

  let body: ExternalApiResponse
  try {
    const res = await fetch(EXTERNAL_VALIDATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`peppolvalidator.com responded with HTTP ${res.status}`)
    body = await res.json() as ExternalApiResponse
  } finally {
    clearTimeout(timer)
  }

  // Map API items → ValidationResult, split by rule-ID prefix:
  //   BR-*           → Phase 2 (CEN EN16931)
  //   PEPPOL-* / *   → Phase 3 (PEPPOL BIS)
  const cenResults: ValidationResult[]   = []
  const peppolResults: ValidationResult[] = []

  const mapItem = (item: ExternalApiItem, passed: boolean, severity: 'error' | 'warning'): ValidationResult => ({
    rule:     item.id ?? item.rule ?? 'UNKNOWN',
    severity,
    message:  item.message ?? `Rule ${item.id ?? item.rule} violated`,
    passed,
  })

  for (const item of body.errors ?? []) {
    const result = mapItem(item, false, 'error')
    if ((item.id ?? item.rule ?? '').startsWith('BR-')) {
      cenResults.push(result)
    } else {
      peppolResults.push(result)
    }
  }

  for (const item of body.warnings ?? []) {
    const result = mapItem(item, true, 'warning')
    if ((item.id ?? item.rule ?? '').startsWith('BR-')) {
      cenResults.push(result)
    } else {
      peppolResults.push(result)
    }
  }

  // Add synthetic OK entries for phases with no violations
  if (cenResults.length === 0) {
    cenResults.push({ rule: 'OK', severity: 'error', message: 'Vsetky EN16931 pravidla su splnene', passed: true })
  }
  if (peppolResults.length === 0) {
    peppolResults.push({ rule: 'OK', severity: 'error', message: 'Vsetky PEPPOL BIS 3.0 pravidla su splnene', passed: true })
  }

  const cenErrors   = cenResults.filter((r) => !r.passed)
  const peppolErrors = peppolResults.filter((r) => !r.passed)

  const phase2: ValidationPhase = {
    name:        'EN16931 pravidla',
    description: 'Europske obchodne pravidla pre e-fakturaciu — peppolvalidator.com',
    results:     cenResults,
    passed:      cenErrors.length === 0,
  }

  const phase3: ValidationPhase = {
    name:        'Peppol BIS schematron pravidla',
    description: 'Specificke Peppol BIS 3.0 pravidla — peppolvalidator.com',
    results:     peppolResults,
    passed:      peppolErrors.length === 0,
  }

  return [phase2, phase3]
}

// ─── JS simulation fallback (last resort) ────────────────────────────────────

function jsFallback(inv: PeppolInvoice): [ValidationPhase, ValidationPhase] {
  const tag = (phase: ValidationPhase): ValidationPhase => ({
    ...phase,
    description: phase.description + ' [SIMULACIA]',
  })
  return [tag(validateEN16931(inv)), tag(validatePeppolSchematron(inv))]
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates a PEPPOL invoice using the following priority chain:
 *  1. Saxon-JS + local SEF files   (primary — runs on Vercel after prebuild)
 *  2. peppolvalidator.com REST API  (fallback — when SEF files not compiled)
 *  3. JS-based simulation           (last resort — if external API unreachable)
 */
export async function validateInvoiceXml(
  xml: string,
  inv: PeppolInvoice
): Promise<ValidationPhase[]> {
  // Phase 1 — always run (fast JSON checks, no XML needed)
  const phase1 = validateStructure(inv)

  // ── Primary: Saxon-JS with local SEF files ──────────────────────────────────
  const cenSefObj    = getCenSef()
  const peppolSefObj = getPeppolSef()

  if (cenSefObj && peppolSefObj) {
    try {
      const [cenAsserts, peppolAsserts] = await Promise.all([
        runSchematron(xml, cenSefObj),
        runSchematron(xml, peppolSefObj),
      ])

      return [
        phase1,
        buildPhase('EN16931 pravidla', 'Europske obchodne pravidla pre e-fakturaciu — oficialny CEN schematron (OpenPEPPOL)', cenAsserts),
        buildPhase('Peppol BIS schematron pravidla', 'Specificke Peppol BIS 3.0 pravidla — oficialny OpenPEPPOL schematron', peppolAsserts),
      ]
    } catch (err) {
      console.error('[real-validation] Saxon-JS failed, trying external API:', (err as Error).message)
    }
  } else {
    console.warn('[real-validation] SEF files not found — trying external API. Run: node scripts/compile-schematron.mjs')
  }

  // ── Fallback: peppolvalidator.com external API ──────────────────────────────
  try {
    const [phase2, phase3] = await validateViaExternalApi(xml)
    return [phase1, phase2, phase3]
  } catch (err) {
    console.error('[real-validation] External API failed, falling back to JS simulation:', (err as Error).message)
  }

  // ── Last resort: JS simulation ───────────────────────────────────────────────
  const [phase2, phase3] = jsFallback(inv)
  return [phase1, phase2, phase3]
}
