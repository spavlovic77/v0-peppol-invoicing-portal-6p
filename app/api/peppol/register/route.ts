import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registerOrganization, IonApError } from '@/lib/ion-ap'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const supplierId = body?.supplier_id || body?.supplierId
  if (!supplierId) {
    return NextResponse.json({ error: 'supplier_id je povinne' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('id, company_name, country_code, dic, peppol_organization_id')
    .eq('id', supplierId)
    .eq('user_id', user.id)
    .single()

  if (error || !supplier) {
    return NextResponse.json({ error: 'Dodavatel nenajdeny' }, { status: 404 })
  }

  if (supplier.peppol_organization_id) {
    return NextResponse.json({
      success: true,
      already_registered: true,
      peppol_organization_id: supplier.peppol_organization_id,
    })
  }

  if (!supplier.dic) {
    return NextResponse.json(
      { error: 'Dodavatel musi mat vyplnene DIC pred registraciou do Peppol' },
      { status: 400 }
    )
  }

  try {
    const org = await registerOrganization({
      name: supplier.company_name,
      country: supplier.country_code || 'SK',
      dic: supplier.dic,
      reference: supplier.id,
    })

    const registeredAt = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('suppliers')
      .update({
        peppol_organization_id: org.id,
        peppol_registered_at: registeredAt,
      })
      .eq('id', supplierId)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[peppol/register] DB update error:', updateErr)
      return NextResponse.json(
        { error: 'Registracia prebehla, ale ulozenie do DB zlyhalo: ' + updateErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      peppol_organization_id: org.id,
      peppol_registered_at: registeredAt,
    })
  } catch (err) {
    if (err instanceof IonApError) {
      console.error('[peppol/register] ion-AP error:', err.status, err.body)
      // 400 = validation (e.g. duplicate identifier), 409 = SMP conflict (not expected w/ publish_in_smp=false)
      const msg =
        err.status === 400
          ? `Registracia zlyhala (ion-AP): ${err.body.substring(0, 200)}`
          : err.status === 409
            ? 'Identifikator je uz registrovany v sieti Peppol'
            : `ION AP chyba: ${err.status}`
      return NextResponse.json({ error: msg }, { status: err.status })
    }
    console.error('[peppol/register] unexpected:', err)
    return NextResponse.json(
      { error: 'Nepodarilo sa pripojit k ION AP' },
      { status: 502 }
    )
  }
}
