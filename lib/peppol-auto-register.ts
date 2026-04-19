// Silent client-side auto-registration of a supplier as a Peppol participant.
// Deduplicates attempts per browser session so rapid supplier switching doesn't
// hammer the API, and swallows errors (console only) so the user is never bothered.

const attempted = new Set<string>()
const inFlight = new Map<string, Promise<boolean>>()

export interface AutoRegisterResult {
  /** true if the supplier ended up registered (either newly or already was). */
  registered: boolean
  /** Only set when an ion-AP org id came back; callers can trigger a refresh. */
  peppolOrganizationId?: number
}

export async function autoRegisterSupplier(
  supplierId: string,
  opts: { force?: boolean } = {}
): Promise<AutoRegisterResult> {
  if (!opts.force && attempted.has(supplierId)) {
    return { registered: false }
  }
  const existing = inFlight.get(supplierId)
  if (existing) {
    const ok = await existing
    return { registered: ok }
  }

  const task = (async () => {
    attempted.add(supplierId)
    try {
      const res = await fetch('/api/peppol/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId }),
      })
      if (res.ok) return true
      // 400 (missing DIC, bad identifier, etc.) — silently leave unregistered; the
      // dedupe flag above prevents retrying until the next page load.
      console.warn('[peppol/auto-register] non-OK:', res.status)
      return false
    } catch (e) {
      console.warn('[peppol/auto-register] network error:', (e as Error).message)
      return false
    }
  })()

  inFlight.set(supplierId, task)
  try {
    const ok = await task
    return { registered: ok }
  } finally {
    inFlight.delete(supplierId)
  }
}

/** Reset the session dedupe — useful if the caller knows state has changed (e.g. DIC was filled in). */
export function resetAutoRegisterDedupe(supplierId?: string): void {
  if (supplierId) attempted.delete(supplierId)
  else attempted.clear()
}
