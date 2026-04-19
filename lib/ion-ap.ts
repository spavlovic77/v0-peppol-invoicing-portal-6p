// ion-AP (Peppol access point) server-side client.
// Uses a single admin/multiaccount token from ION_AP_ADMIN_TOKEN.
// All supplier organizations live under that admin account; we store only
// their ion-AP Organization ID on our `suppliers` row.

export const ION_AP_BASE_URL =
  process.env.ION_AP_BASE_URL || 'https://test.ion-ap.net'

const ADMIN_TOKEN = process.env.ION_AP_ADMIN_TOKEN || ''

export const SK_PEPPOL_SCHEME = '0245' // Slovakia — DIC
export const ISO6523_SCHEME = 'iso6523-actorid-upis'

export function buildSkPeppolIdentifier(dic: string): string {
  return `${SK_PEPPOL_SCHEME}:${dic.trim()}`
}

export class IonApError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message?: string) {
    super(message || `ion-AP ${status}: ${body.substring(0, 300)}`)
    this.status = status
    this.body = body
  }
}

function requireAdminToken(): string {
  if (!ADMIN_TOKEN) {
    throw new IonApError(
      500,
      'ION_AP_ADMIN_TOKEN is not configured',
      'ION AP admin token nie je nastaveny v prostredi servera'
    )
  }
  return ADMIN_TOKEN
}

interface FetchOptions {
  method?: string
  body?: BodyInit | null
  contentType?: string
  accept?: string
}

export async function ionApFetch(
  path: string,
  { method = 'GET', body = null, contentType, accept = 'application/json' }: FetchOptions = {}
): Promise<Response> {
  const token = requireAdminToken()
  const headers: Record<string, string> = {
    Authorization: `Token ${token}`,
    Accept: accept,
  }
  if (contentType) headers['Content-Type'] = contentType
  return fetch(`${ION_AP_BASE_URL}${path}`, { method, headers, body })
}

export async function ionApJson<T = unknown>(
  path: string,
  opts: FetchOptions = {}
): Promise<T> {
  const res = await ionApFetch(path, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new IonApError(res.status, text)
  }
  return (await res.json()) as T
}

// ---------- Typed helpers ----------

export interface RegisterOrgInput {
  name: string
  country: string
  dic: string
  reference?: string
}

export interface CreatedOrganization {
  id: number
  name: string
  country: string
  reference?: string
  identifiers: Array<{ id: number; identifier: string; verified: boolean }>
}

export async function registerOrganization(
  input: RegisterOrgInput
): Promise<CreatedOrganization> {
  const payload = {
    name: input.name,
    country: input.country,
    publish_in_smp: false,
    reference: input.reference ?? '',
    identifiers: [
      {
        scheme: ISO6523_SCHEME,
        identifier: buildSkPeppolIdentifier(input.dic),
        verified: true,
        publish_receive_peppolbis: false,
        publish_receive_nlcius: false,
        publish_receive_invoice_response: false,
      },
    ],
    receive_triggers: [],
  }
  return ionApJson<CreatedOrganization>('/api/v2/organizations/create-full', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

export interface ParticipantPresence {
  exists: boolean
  detail: string
}

export async function discoverParticipant(
  identifier: string
): Promise<{ found: boolean; data?: ParticipantPresence }> {
  const encoded = encodeURIComponent(identifier)
  const res = await ionApFetch(`/api/v2/discover/${encoded}?log_level=NOTSET`)
  if (res.status === 200) {
    const data = (await res.json()) as ParticipantPresence
    return { found: !!data.exists, data }
  }
  if (res.status === 404) return { found: false }
  const text = await res.text()
  throw new IonApError(res.status, text)
}

export async function findOrganizationByIdentifier(
  identifier: string
): Promise<number | null> {
  try {
    const res = await ionApFetch(
      `/api/v2/organizations?filter_identifier=${encodeURIComponent(identifier)}&limit=5`
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: Array<{ id: number; identifiers?: Array<{ identifier: string }> }>
    }
    const match = (data.results ?? []).find((org) =>
      (org.identifiers ?? []).some(
        (i) => i.identifier.toLowerCase() === identifier.toLowerCase()
      )
    )
    return match?.id ?? data.results?.[0]?.id ?? null
  } catch {
    return null
  }
}

export async function sendDocument(xml: string): Promise<{ id?: number; transaction_id?: string; [k: string]: unknown }> {
  return ionApJson('/api/v2/send-document', {
    method: 'POST',
    contentType: 'application/xml',
    body: xml,
  })
}

export async function getSendTransaction(
  transactionId: string | number
): Promise<{ state?: string; status?: string; [k: string]: unknown }> {
  return ionApJson(`/api/v2/send-transactions/${transactionId}`)
}
