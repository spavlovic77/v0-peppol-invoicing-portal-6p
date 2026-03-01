import { GlassCard } from '@/components/glass-card'
import { FileText, Building2, CreditCard, Package, Calculator } from 'lucide-react'
import type { InvoiceFormData, CompanyProfile } from '@/lib/schemas'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface TaxRecapRow {
  rate: number
  base: number
  vat: number
  total: number
}

interface CorrectionRow {
  rate: number
  amount: number
  isCharge: boolean
}

function buildRecap(items: InvoiceFormData['items'], globalDiscountPct: number): {
  rows: TaxRecapRow[]
  corrections: CorrectionRow[]
} {
  const lineExtTotal = items.reduce((s, it) => {
    const gross = it.quantity * it.unit_price
    const disc = it.discount_amount || round2(gross * (it.discount_percent || 0) / 100)
    return s + round2(gross - disc)
  }, 0)
  const globalDiscountAmt = round2(lineExtTotal * globalDiscountPct / 100)

  const groups = new Map<number, { lineTotal: number; grossSum: number }>()
  for (const it of items) {
    const rate = it.vat_rate || 0
    const gross = it.quantity * it.unit_price
    const disc = it.discount_amount || round2(gross * (it.discount_percent || 0) / 100)
    const lineNet = round2(gross - disc)
    const lineGross = round2(lineNet * (100 + rate) / 100)
    const existing = groups.get(rate)
    if (existing) {
      existing.lineTotal += lineNet
      existing.grossSum += lineGross
    } else {
      groups.set(rate, { lineTotal: lineNet, grossSum: lineGross })
    }
  }

  const rows: TaxRecapRow[] = []
  const corrections: CorrectionRow[] = []

  for (const [rate, group] of groups) {
    const proportion = lineExtTotal > 0 ? group.lineTotal / lineExtTotal : 1
    const allocDiscount = round2(globalDiscountAmt * proportion)
    const taxBase_EN = round2(group.lineTotal - allocDiscount)

    if (rate === 0) {
      rows.push({ rate, base: taxBase_EN, vat: 0, total: taxBase_EN })
      continue
    }

    let grossWithVat = round2(group.grossSum)
    if (globalDiscountAmt > 0 && lineExtTotal > 0) {
      const discGross = round2(allocDiscount * (100 + rate) / 100)
      grossWithVat = round2(grossWithVat - discGross)
    }

    const tax_SK = round2(grossWithVat * rate / (100 + rate))
    const base_SK = round2(grossWithVat - tax_SK)
    const correction = round2(base_SK - taxBase_EN)

    if (correction !== 0) {
      corrections.push({ rate, amount: correction, isCharge: correction > 0 })
    }

    rows.push({ rate, base: base_SK, vat: tax_SK, total: round2(base_SK + tax_SK) })
  }

  rows.sort((a, b) => b.rate - a.rate)
  return { rows, corrections }
}

interface Props {
  formData: InvoiceFormData
  profile: CompanyProfile
  totals: { withoutVat: number; vat: number; withVat: number }
  isVatPayer?: boolean
}

export function StepSummary({ formData, profile, totals, isVatPayer = true }: Props) {
  const fmt = (n: number) =>
    n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const { rows: recapRows, corrections } = buildRecap(formData.items, formData.global_discount_percent || 0)

  return (
    <div className="space-y-6">
      {/* Invoice Info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Faktura {formData.invoice_number}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Vystavena</span>
            <div className="text-foreground font-medium">{formData.issue_date}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Splatnost</span>
            <div className="text-foreground font-medium">{formData.due_date}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Dodanie</span>
            <div className="text-foreground font-medium">{formData.delivery_date || '-'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Mena</span>
            <div className="text-foreground font-medium">{formData.currency}</div>
          </div>
        </div>
      </GlassCard>

      {/* Supplier + Buyer */}
      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Dodavatel</h2>
          </div>
          <div className="space-y-1 text-sm">
            <div className="text-foreground font-medium">{profile.company_name}</div>
            <div className="text-muted-foreground">{profile.street}</div>
            <div className="text-muted-foreground">{profile.postal_code} {profile.city}</div>
            <div className="text-muted-foreground mt-2">ICO: {profile.ico}</div>
            {profile.dic && <div className="text-muted-foreground">DIC: {profile.dic}</div>}
            {profile.ic_dph && <div className="text-muted-foreground">IC DPH: {profile.ic_dph}</div>}
            {profile.dic && (
              <div className="text-primary font-mono text-xs mt-2">Peppol: 9950:{profile.dic}</div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-chart-2" />
            <h2 className="font-semibold text-foreground">Odberatel</h2>
          </div>
          <div className="space-y-1 text-sm">
            <div className="text-foreground font-medium">{formData.buyer_name}</div>
            <div className="text-muted-foreground">{formData.buyer_street}</div>
            <div className="text-muted-foreground">{formData.buyer_postal_code} {formData.buyer_city}</div>
            {formData.buyer_ico && <div className="text-muted-foreground mt-2">ICO: {formData.buyer_ico}</div>}
            {formData.buyer_dic && <div className="text-muted-foreground">DIC: {formData.buyer_dic}</div>}
            {formData.buyer_ic_dph && <div className="text-muted-foreground">IC DPH: {formData.buyer_ic_dph}</div>}
            {formData.buyer_peppol_id && (
              <div className="text-chart-2 font-mono text-xs mt-2">Peppol: {formData.buyer_peppol_id}</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Payment */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Platobne udaje</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Sposob platby</span>
            <div className="text-foreground">
              {
                { '30': 'Bankovy prevod', '58': 'SEPA prevod', '48': 'Platba kartou', '10': 'Hotovost', '42': 'Na ucet', '1': 'Ine' }[formData.payment_means_code] || formData.payment_means_code
              }
            </div>
          </div>
          {formData.bank_name && (
            <div>
              <span className="text-muted-foreground">Banka</span>
              <div className="text-foreground">{formData.bank_name}</div>
            </div>
          )}
          {formData.iban && (
            <div>
              <span className="text-muted-foreground">IBAN</span>
              <div className="text-foreground font-mono text-xs">{formData.iban}</div>
            </div>
          )}
          {formData.variable_symbol && (
            <div>
              <span className="text-muted-foreground">Variabilny symbol</span>
              <div className="text-foreground">{formData.variable_symbol}</div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Items */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Polozky ({formData.items.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Popis</th>
                <th className="pb-2 font-medium text-right">Mn.</th>
                <th className="pb-2 font-medium text-right">Cena</th>
                <th className="pb-2 font-medium text-right">Zlava</th>
                {isVatPayer && <th className="pb-2 font-medium text-right">DPH</th>}
                <th className="pb-2 font-medium text-right">Spolu</th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((item, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 text-foreground">{item.description || '-'}</td>
                  <td className="py-2 text-right text-foreground">{item.quantity}</td>
                  <td className="py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {(item.discount_percent || 0) > 0 ? `${item.discount_percent}%` : '-'}
                  </td>
                  {isVatPayer && <td className="py-2 text-right text-muted-foreground">{item.vat_rate}%</td>}
                  <td className="py-2 text-right text-foreground font-medium">
                    {fmt(item.line_total || item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* VAT Recapitulation */}
      {isVatPayer && <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Rekapitulacia DPH</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-medium">Sadzba</th>
                <th className="pb-2 font-medium text-right">Zaklad dane</th>
                <th className="pb-2 font-medium text-right">DPH</th>
                <th className="pb-2 font-medium text-right">Spolu</th>
              </tr>
            </thead>
            <tbody>
              {recapRows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 text-foreground font-medium">{row.rate}%</td>
                  <td className="py-2 text-right text-foreground">{fmt(row.base)} {formData.currency}</td>
                  <td className="py-2 text-right text-foreground">{fmt(row.vat)} {formData.currency}</td>
                  <td className="py-2 text-right text-foreground font-medium">{fmt(row.total)} {formData.currency}</td>
                </tr>
              ))}
              {corrections.map((c, i) => (
                <tr key={`c${i}`} className="border-t border-border bg-amber-500/5">
                  <td className="py-2 text-amber-700 dark:text-amber-400 text-xs italic">
                    Korekcia {c.rate}%
                  </td>
                  <td className="py-2 text-right text-amber-700 dark:text-amber-400 text-xs italic">
                    {c.isCharge ? '+' : '-'}{fmt(Math.abs(c.amount))} {formData.currency}
                  </td>
                  <td className="py-2"></td>
                  <td className="py-2 text-right text-amber-700 dark:text-amber-400 text-xs italic">
                    Zaokruhlovacia korekcia
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>}

      {/* Totals */}
      <GlassCard heavy>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zaklad dane:</span>
            <span className="text-foreground">{fmt(totals.withoutVat)} {formData.currency}</span>
          </div>
          {(formData.global_discount_percent || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Zlava na fakturu ({formData.global_discount_percent}%):</span>
              <span className="text-primary">zahrnuta v zaklade</span>
            </div>
          )}
          {isVatPayer && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">DPH:</span>
              <span className="text-foreground">{fmt(totals.vat)} {formData.currency}</span>
            </div>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Na uhradu:</span>
            <span className="text-2xl font-bold text-primary">{fmt(totals.withVat)} {formData.currency}</span>
          </div>
          {!isVatPayer && (
            <p className="text-xs text-muted-foreground mt-2">Dodavatel nie je platcom DPH</p>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
