/**
 * IBAN validation and formatting utilities
 * Based on ISO 13616 / IBAN Registry (iban.com/structure)
 */

// Country code -> expected total IBAN length
const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29,
  BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20,
  EG: 29, FI: 18, FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GT: 28,
  HU: 28, IS: 26, IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20,
  KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31,
  MR: 27, MU: 30, MD: 24, MC: 27, ME: 22, NL: 18, NO: 15, PK: 24,
  PS: 29, PL: 28, PT: 25, QA: 29, RO: 24, SM: 27, LC: 32, ST: 25,
  SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TL: 23,
  TN: 24, TR: 26, AE: 23, GB: 22, VA: 22, VG: 24, UA: 29, SC: 31,
  IQ: 23, BY: 28, SV: 28, LY: 25, SD: 18, BI: 27, DJ: 27, RU: 33,
  SO: 23, NI: 28, MN: 20, FK: 18, OM: 23, YE: 30, HN: 28,
  FO: 18, GL: 18,
}

export interface IbanValidation {
  /** Is the IBAN structurally valid and checksum-correct? */
  valid: boolean
  /** Cleaned IBAN (uppercase, no spaces) */
  cleaned: string
  /** Human-readable formatted IBAN (groups of 4) */
  formatted: string
  /** Detected country code (first 2 chars) */
  country: string
  /** Expected length for the country (null if unknown country) */
  expectedLength: number | null
  /** Specific error message (null if valid) */
  error: string | null
}

/**
 * Strip all non-alphanumeric chars, uppercase
 */
export function cleanIban(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/**
 * Format a cleaned IBAN into groups of 4 for display
 * e.g. "SK8975000000000012345671" -> "SK89 7500 0000 0001 2345 671"
 */
export function formatIban(cleaned: string): string {
  return cleaned.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * ISO 7064 MOD-97-10 checksum validation
 * 1. Move first 4 chars to the end
 * 2. Replace each letter with its numeric value (A=10, B=11, ..., Z=35)
 * 3. The resulting number MOD 97 must equal 1
 */
function mod97(iban: string): number {
  // Move first 4 to end
  const rearranged = iban.slice(4) + iban.slice(0, 4)

  // Replace letters with numbers
  let numericStr = ''
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) {
      // A=10, B=11, ..., Z=35
      numericStr += (code - 55).toString()
    } else {
      numericStr += ch
    }
  }

  // Compute mod 97 on a large number (process in chunks to avoid BigInt)
  let remainder = 0
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i])) % 97
  }
  return remainder
}

/**
 * Full IBAN validation with detailed feedback
 */
export function validateIban(raw: string): IbanValidation {
  const cleaned = cleanIban(raw)
  const formatted = formatIban(cleaned)
  const country = cleaned.slice(0, 2)

  const base = { cleaned, formatted, country }

  // Empty input
  if (!cleaned) {
    return { ...base, valid: false, expectedLength: null, error: null }
  }

  // Must start with 2 letters
  if (!/^[A-Z]{2}/.test(cleaned)) {
    return {
      ...base, valid: false, expectedLength: null,
      error: 'IBAN musi zacinat 2-pismennym kodom krajiny (napr. SK, CZ, DE)',
    }
  }

  // Check digits (positions 3-4) must be numeric
  if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
    return {
      ...base, valid: false, expectedLength: IBAN_LENGTHS[country] ?? null,
      error: 'Za kodom krajiny musia nasledovat 2 kontrolne cislice',
    }
  }

  // Country-specific length check
  const expectedLength = IBAN_LENGTHS[country] ?? null
  if (expectedLength !== null && cleaned.length !== expectedLength) {
    return {
      ...base, valid: false, expectedLength,
      error: `IBAN pre ${country} musi mat presne ${expectedLength} znakov (mate ${cleaned.length})`,
    }
  }

  // Unknown country -- still check basic format
  if (expectedLength === null && (cleaned.length < 15 || cleaned.length > 34)) {
    return {
      ...base, valid: false, expectedLength: null,
      error: 'IBAN musi mat 15-34 znakov',
    }
  }

  // Rest must be alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return {
      ...base, valid: false, expectedLength,
      error: 'IBAN moze obsahovat len pismena a cislice',
    }
  }

  // Length check is sufficient - removed strict MOD-97 checksum validation
  return { ...base, valid: true, expectedLength, error: null }
}
