/**
 * Real PEPPOL BIS 3.0 schematron validation using Saxon-JS.
 *
 * Runs the official OpenPEPPOL schematron rules against the generated UBL XML.
 * The .sef.json files are produced by: node scripts/compile-schematron.mjs
 *
 * Falls back to the existing JS-based validation if SEF files are not yet compiled.
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates a PEPPOL invoice using:
 *  - Phase 1: Structural check on the JSON object (fast, always runs)
 *  - Phase 2: Official CEN EN16931 schematron on the UBL XML
 *  - Phase 3: Official PEPPOL BIS 3.0 schematron on the UBL XML
 *
 * Falls back to JS-based simulation for phases 2 & 3 if SEF files are missing
 * (i.e., compile-schematron.mjs has not been run yet).
 */
export async function validateInvoiceXml(
  xml: string,
  inv: PeppolInvoice
): Promise<ValidationPhase[]> {
  // Phase 1 — always run (fast JSON checks)
  const phase1 = validateStructure(inv)

  // Check if compiled SEF files are available
  const cenSefObj   = getCenSef()
  const peppolSefObj = getPeppolSef()

  if (!cenSefObj || !peppolSefObj) {
    // SEF files not compiled yet — fall back to JS simulation with a warning banner
    console.warn(
      '[real-validation] SEF files not found — falling back to JS-based validation.\n' +
      '  Run: node scripts/compile-schematron.mjs'
    )
    const phase2 = validateEN16931(inv)
    const phase3 = validatePeppolSchematron(inv)

    // Append a warning note to each phase so the UI shows it's simulated
    const simulationNote = (phase: ValidationPhase): ValidationPhase => ({
      ...phase,
      description: phase.description + ' [SIMULACIA — spustite compile-schematron.mjs pre realnu validaciu]',
    })

    return [phase1, simulationNote(phase2), simulationNote(phase3)]
  }

  // Real schematron validation — run both in parallel
  try {
    const [cenAsserts, peppolAsserts] = await Promise.all([
      runSchematron(xml, cenSefObj),
      runSchematron(xml, peppolSefObj),
    ])

    const phase2 = buildPhase(
      'EN16931 pravidla',
      'Europske obchodne pravidla pre e-fakturaciu — oficialny CEN schematron (OpenPEPPOL)',
      cenAsserts
    )

    const phase3 = buildPhase(
      'Peppol BIS schematron pravidla',
      'Specificke Peppol BIS 3.0 pravidla — oficialny OpenPEPPOL schematron',
      peppolAsserts
    )

    return [phase1, phase2, phase3]
  } catch (err) {
    // Schematron execution failed (e.g., malformed XML, SaxonJS error)
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[real-validation] Schematron execution error:', errMsg)

    const errorPhase = (name: string, desc: string): ValidationPhase => ({
      name,
      description: desc,
      results: [
        {
          rule:     'SYSTEM',
          severity: 'error',
          message:  `Schematron validacia zlyhala: ${errMsg}`,
          passed:   false,
        },
      ],
      passed: false,
    })

    return [
      phase1,
      errorPhase('EN16931 pravidla', 'Europske obchodne pravidla pre e-fakturaciu'),
      errorPhase('Peppol BIS schematron pravidla', 'Specificke Peppol BIS 3.0 pravidla'),
    ]
  }
}
