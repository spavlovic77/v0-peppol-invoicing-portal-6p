// Silent Peppol discovery for buyer contacts. Checks whether the buyer is a
// registered Peppol participant and persists the result (peppol_id + timestamp)
// back into buyer_contacts. Fire-and-forget; errors are logged only.
import { createClient } from '@/lib/supabase/client'

const attempted = new Set<string>()
const inFlight = new Map<string, Promise<boolean>>()

export function buildSkPeppolIdentifier(dic: string): string {
  return `0245:${dic.trim()}`
}

export interface DiscoverInput {
  buyerId: string
  dic: string | null | undefined
  countryCode?: string | null
}

/**
 * Runs Peppol discovery for a buyer and persists the result. Returns true if
 * the buyer is registered (and peppol_id was just set), false otherwise.
 * Silently skips if DIC is missing or country is not supported.
 */
export async function discoverBuyer(
  input: DiscoverInput,
  opts: { force?: boolean } = {}
): Promise<boolean> {
  const { buyerId, dic, countryCode } = input
  if (!dic || !dic.trim()) return false
  // Currently only Slovak scheme (0245) is supported.
  if (countryCode && countryCode.toUpperCase() !== 'SK') return false

  if (!opts.force && attempted.has(buyerId)) return false
  const existing = inFlight.get(buyerId)
  if (existing) return existing

  const task = (async () => {
    attempted.add(buyerId)
    const identifier = buildSkPeppolIdentifier(dic)
    let found = false
    try {
      const res = await fetch(
        `/api/peppol/discover?identifier=${encodeURIComponent(identifier)}`
      )
      if (res.ok) {
        const data = (await res.json()) as { found?: boolean }
        found = !!data.found
      }
    } catch (e) {
      console.warn('[peppol/buyer-discover] network error:', (e as Error).message)
    }

    try {
      const supabase = createClient()
      await supabase
        .from('buyer_contacts')
        .update({
          peppol_id: found ? identifier : null,
          peppol_checked_at: new Date().toISOString(),
        })
        .eq('id', buyerId)
    } catch (e) {
      console.warn('[peppol/buyer-discover] DB update failed:', (e as Error).message)
    }
    return found
  })()

  inFlight.set(buyerId, task)
  try {
    return await task
  } finally {
    inFlight.delete(buyerId)
  }
}

export function resetBuyerDiscoveryDedupe(buyerId?: string): void {
  if (buyerId) attempted.delete(buyerId)
  else attempted.clear()
}
