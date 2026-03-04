/**
 * Peppol Electronic Address Identifier Scheme (EAS)
 *
 * 9950 = ICD test/ACC network (used during development)
 * 0245 = SK DIC (Slovak tax identifier) — production Peppol network
 *
 * This value is used as the schemeID for both supplier and buyer
 * EndpointID elements in UBL invoices.
 */
export const PEPPOL_IDENTIFIER_SCHEME = '9950'
