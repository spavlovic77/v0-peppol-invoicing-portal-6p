import { NextResponse } from 'next/server'

interface RegisterUZSearch {
  id: number[]
  existujeDalsieId: boolean
}

interface RegisterUZDetail {
  id: number
  nazovUJ: string
  ico: string
  dic?: string
  mesto?: string
  ulica?: string
  psc?: string
  pravnaForma?: string
  kraj?: string
  okres?: string
  datumZalozenia?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ico = searchParams.get('ico')

  if (!ico || ico.length < 6 || ico.length > 8) {
    return NextResponse.json({ error: 'Neplatne ICO (6-8 cifier)' }, { status: 400 })
  }

  const paddedICO = ico.padStart(8, '0')

  try {
    // Step 1: Search for the company by ICO
    const searchUrl = `https://www.registeruz.sk/cruz-public/api/uctovne-jednotky?zmenene-od=2000-01-01&pokracovat-za-id=1&max-zaznamov=1&ico=${paddedICO}`
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!searchRes.ok) {
      return NextResponse.json(
        { error: 'Chyba pri komunikacii s registrom' },
        { status: 502 }
      )
    }

    const searchData: RegisterUZSearch = await searchRes.json()

    if (!searchData.id || searchData.id.length === 0) {
      return NextResponse.json(
        { error: 'Subjekt s danym ICO nebol najdeny v registri' },
        { status: 404 }
      )
    }

    // Step 2: Get detail by internal ID
    const detailUrl = `https://www.registeruz.sk/cruz-public/api/uctovna-jednotka?id=${searchData.id[0]}`
    const detailRes = await fetch(detailUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!detailRes.ok) {
      return NextResponse.json(
        { error: 'Nepodarilo sa nacitat detail subjektu' },
        { status: 502 }
      )
    }

    const detail: RegisterUZDetail = await detailRes.json()

    // Map the response to our format
    const companyData = {
      ico: detail.ico || paddedICO,
      company_name: detail.nazovUJ || '',
      dic: detail.dic || null,
      ic_dph: detail.dic ? `SK${detail.dic}` : null,
      street: detail.ulica || null,
      city: detail.mesto || null,
      postal_code: detail.psc || null,
      country_code: 'SK',
      registration_court: null,
      registration_number: null,
    }

    return NextResponse.json(companyData)
  } catch (error) {
    console.error('RPO lookup error:', error)
    return NextResponse.json(
      { error: 'Nepodarilo sa nacitat udaje. Skuste to neskor alebo vyplnte manualne.' },
      { status: 503 }
    )
  }
}
