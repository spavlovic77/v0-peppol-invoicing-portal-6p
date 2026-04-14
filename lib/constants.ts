/**
 * Peppol Electronic Address Identifier Scheme (EAS)
 *
 * 9950 = ICD test/ACC network (used during development)
 * 0245 = SK DIC (Slovak tax identifier) — production Peppol network
 *
 * This value is used as the schemeID for both supplier and buyer
 * EndpointID elements in UBL invoices.
 */
export const PEPPOL_IDENTIFIER_SCHEME = '0245'

// UNTDID 5189 allowance reason codes (BT-98 / BT-140)
export const ALLOWANCE_REASON_CODES = [
  { code: '95', label: 'Zľava' },
  { code: '41', label: 'Bonus' },
  { code: '62', label: 'Množstevná zľava' },
  { code: '71', label: 'Vernostná zľava' },
] as const

// UNTDID 7161 charge reason codes (BT-105 / BT-145)
export const CHARGE_REASON_CODES = [
  { code: 'FC', label: 'Doprava' },
  { code: 'ABL', label: 'Balné' },
  { code: 'CG', label: 'Čistenie' },
  { code: 'ADR', label: 'Iné služby' },
] as const

export const DEFAULT_ALLOWANCE_REASON_CODE = '95'
export const DEFAULT_CHARGE_REASON_CODE = 'FC'

export function allowanceReasonLabel(code: string | null | undefined): string {
  if (!code) return 'Zľava'
  return ALLOWANCE_REASON_CODES.find((r) => r.code === code)?.label || 'Zľava'
}

export function chargeReasonLabel(code: string | null | undefined): string {
  if (!code) return 'Doprava'
  return CHARGE_REASON_CODES.find((r) => r.code === code)?.label || 'Prirážka'
}
