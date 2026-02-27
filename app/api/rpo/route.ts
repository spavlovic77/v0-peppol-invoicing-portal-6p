import { NextResponse } from 'next/server'

interface RPOResponse {
  id: number
  ico: string
  nazov: string
  dic?: string
  ic_dph?: string
  adresa?: {
    ulica?: string
    cisloDomu?: string
    obec?: string
    psc?: string
    stat?: string
  }
  pravnaForma?: string
  registracia?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ico = searchParams.get('ico')

  if (!ico || ico.length < 6) {
    return NextResponse.json({ error: 'Neplatne ICO' }, { status: 400 })
  }

  try {
    // Try Slovak RPO API
    const response = await fetch(
      `https://rpo.statistics.sk/rpo/json/full/${ico}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!response.ok) {
      // Fallback: try FinStat-like API or return not found
      return NextResponse.json(
        { error: 'Subjekt s danym ICO nebol najdeny' },
        { status: 404 }
      )
    }

    const data = await response.json()

    // The RPO API returns data in a specific structure
    // Extract relevant fields
    let companyData
    if (data && typeof data === 'object') {
      // RPO returns detailed data - extract what we need
      const name = data.nazov || data.obchodneMeno || data.name || ''
      const addresses = data.adresy || data.sidlo || []
      const addr = Array.isArray(addresses) ? addresses[0] : addresses || {}

      const street = [addr.ulica, addr.supisneCislo || addr.cisloDomu]
        .filter(Boolean)
        .join(' ')

      companyData = {
        ico: ico.padStart(8, '0'),
        company_name: name,
        dic: data.dic || null,
        ic_dph: data.icDph || data.ic_dph || null,
        street: street || null,
        city: addr.obec || addr.mesto || null,
        postal_code: addr.psc || null,
        country_code: 'SK',
        registration_court: data.registracia || null,
        registration_number: data.registracneCislo || null,
      }
    } else {
      return NextResponse.json(
        { error: 'Neocakavany format odpovede' },
        { status: 500 }
      )
    }

    return NextResponse.json(companyData)
  } catch (error) {
    // If RPO API fails, try alternative source
    try {
      const finstatResponse = await fetch(
        `https://www.finstat.sk/api/detail?ico=${ico}&apikey=demo`,
        { signal: AbortSignal.timeout(5000) }
      )

      if (finstatResponse.ok) {
        const fsData = await finstatResponse.json()
        return NextResponse.json({
          ico: ico.padStart(8, '0'),
          company_name: fsData.Name || '',
          dic: fsData.Dic || null,
          ic_dph: fsData.IcDph || null,
          street: fsData.Street || null,
          city: fsData.City || null,
          postal_code: fsData.ZipCode || null,
          country_code: 'SK',
          registration_court: fsData.RegistrationCourt || null,
          registration_number: fsData.RegistrationNumber || null,
        })
      }
    } catch {
      // Ignore secondary failure
    }

    return NextResponse.json(
      { error: 'Nepodarilo sa nacitat udaje. Skuste to neskor alebo vyplnte manualne.' },
      { status: 503 }
    )
  }
}
