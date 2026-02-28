#!/usr/bin/env node
/**
 * Downloads and compiles official PEPPOL BIS 3.0 schematron files to Saxon SEF JSON format.
 *
 * Run manually:  node scripts/compile-schematron.mjs
 * Runs automatically via:  npm run prebuild  (on Vercel builds)
 *
 * Output: lib/schematron/CEN-EN16931-UBL.sef.json
 *         lib/schematron/PEPPOL-EN16931-UBL.sef.json
 *
 * Re-run whenever OpenPEPPOL publishes a new release (update PEPPOL_TAG below).
 */

import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCHEMATRON_DIR = join(ROOT, 'lib', 'schematron')
const TEMP_DIR = join(SCHEMATRON_DIR, '_temp')

// ─── OpenPEPPOL release tag ───────────────────────────────────────────────────
// Check https://github.com/OpenPEPPOL/peppol-bis-invoice-3/releases for updates
const PEPPOL_TAG = 'v3.0.19'
const PEPPOL_BASE = `https://raw.githubusercontent.com/OpenPEPPOL/peppol-bis-invoice-3/${PEPPOL_TAG}/rules/sch`

// ISO Schematron skeleton (converts .sch → .xsl)
// Primary source: Schematron/stf repo (official XSLT 2.0 / Saxon skeleton)
// Fallback: OpenPEPPOL's own copy bundled in their older peppol-bis repo
const ISO_SKELETON_URLS = [
  'https://raw.githubusercontent.com/Schematron/stf/master/iso-schematron-xslt2/iso_schematron_skeleton_for_saxon.xsl',
  'https://raw.githubusercontent.com/OpenPEPPOL/peppol-bis/master/script/iso-schematron-xslt2/iso_schematron_skeleton_for_saxon.xsl',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function download(url, destPath) {
  process.stdout.write(`  Downloading ${url.split('/').pop()} ...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`)
  writeFileSync(destPath, await res.text(), 'utf-8')
  console.log(' done')
}

async function downloadWithFallback(urls, destPath) {
  const errors = []
  for (const url of urls) {
    try {
      await download(url, destPath)
      return
    } catch (err) {
      errors.push(`${url}: ${err.message}`)
      process.stdout.write(` (retrying...)\n`)
    }
  }
  throw new Error(`All sources failed:\n  ${errors.join('\n  ')}`)
}

function xslt3(...args) {
  // Find xslt3 JS entry from installed package (cross-platform, no shell tricks needed)
  const xslt3Pkg = join(ROOT, 'node_modules', 'xslt3', 'xslt3.js')
  if (!existsSync(xslt3Pkg)) {
    throw new Error(
      'xslt3 package not found. Run: npm install --save-dev xslt3'
    )
  }

  const result = spawnSync(process.execPath, [xslt3Pkg, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf-8',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`xslt3 exited with code ${result.status}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const forceRecompile = process.argv.includes('--force')

  const cenSef = join(SCHEMATRON_DIR, 'CEN-EN16931-UBL.sef.json')
  const peppolSef = join(SCHEMATRON_DIR, 'PEPPOL-EN16931-UBL.sef.json')

  if (!forceRecompile && existsSync(cenSef) && existsSync(peppolSef)) {
    console.log('✓ Schematron SEF files already exist — skipping compilation.')
    console.log('  Use --force to recompile.')
    return
  }

  console.log('=== Compiling PEPPOL BIS 3.0 Schematron → SEF JSON ===')
  console.log(`  Release: ${PEPPOL_TAG}\n`)

  mkdirSync(SCHEMATRON_DIR, { recursive: true })
  mkdirSync(TEMP_DIR, { recursive: true })

  // ── Step 1: Download source files ──────────────────────────────────────────
  console.log('Downloading source files...')
  const skeletonPath  = join(TEMP_DIR, 'iso_skeleton.xsl')
  const cenSchPath    = join(TEMP_DIR, 'CEN-EN16931-UBL.sch')
  const peppolSchPath = join(TEMP_DIR, 'PEPPOL-EN16931-UBL.sch')

  await downloadWithFallback(ISO_SKELETON_URLS, skeletonPath)
  await download(`${PEPPOL_BASE}/CEN-EN16931-UBL.sch`, cenSchPath)
  await download(`${PEPPOL_BASE}/PEPPOL-EN16931-UBL.sch`, peppolSchPath)

  // ── Step 2: Compile each schematron ────────────────────────────────────────
  const schemas = [
    { name: 'CEN-EN16931-UBL',   sch: cenSchPath,   sef: cenSef },
    { name: 'PEPPOL-EN16931-UBL', sch: peppolSchPath, sef: peppolSef },
  ]

  for (const { name, sch, sef } of schemas) {
    console.log(`\nCompiling ${name}...`)
    const xslPath = join(TEMP_DIR, `${name}.xsl`)

    // Step 2a: .sch → .xsl  (apply ISO skeleton as XSLT transform)
    console.log('  [1/2] Schematron → XSLT')
    xslt3(`-xsl:${skeletonPath}`, `-s:${sch}`, `-o:${xslPath}`)

    // Step 2b: .xsl → .sef.json  (compile XSLT to Saxon Export Format)
    console.log('  [2/2] XSLT → SEF JSON')
    xslt3(`-t`, `-xsl:${xslPath}`, `-export:${sef}`, `-nogo`)

    console.log(`  ✓ lib/schematron/${name}.sef.json`)
  }

  // ── Cleanup temp files ─────────────────────────────────────────────────────
  rmSync(TEMP_DIR, { recursive: true, force: true })

  // Write a metadata file so we know which release was compiled
  writeFileSync(
    join(SCHEMATRON_DIR, 'version.json'),
    JSON.stringify({ peppolTag: PEPPOL_TAG, compiledAt: new Date().toISOString() }, null, 2)
  )

  console.log('\n✓ Compilation complete!')
  console.log('  Commit lib/schematron/*.sef.json to avoid recompiling on every deploy.\n')
}

main().catch((err) => {
  console.error('\n✗ Compilation failed:', err.message)
  process.exit(1)
})
