'use client'

import { GlassCard } from '@/components/glass-card'
import { Calculator, Package, ArrowRight } from 'lucide-react'

// Helper to round to 2 decimal places
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// Format currency
function fmt(n: number): string {
  return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Generate 10 line items: qty=3, price=7.33 EUR each
const LINE_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  description: `Položka ${i + 1}`,
  quantity: 3,
  unit_price: 7.33,
  vat_rate: 23,
}))

export default function VatComparisonPage() {
  // ─── EN16931 Forward Method ───────────────────────────────────────────────
  // tax = taxBase * rate / 100
  const enItems = LINE_ITEMS.map((item) => {
    const lineTotal = r2(item.quantity * item.unit_price) // 3 * 7.33 = 21.99
    return {
      ...item,
      line_total: lineTotal,
    }
  })
  const enTaxBase = r2(enItems.reduce((sum, it) => sum + it.line_total, 0)) // 219.90
  const enTax = r2(enTaxBase * 23 / 100) // 50.577 -> 50.58
  const enGross = r2(enTaxBase + enTax) // 270.48

  // ─── SK Reverse Method ────────────────────────────────────────────────────
  // For each line: gross = qty * price * (1 + rate/100), tax = gross * rate / (100 + rate)
  const skItems = LINE_ITEMS.map((item) => {
    const lineNet = r2(item.quantity * item.unit_price) // 21.99
    const lineGross = r2(lineNet * (1 + item.vat_rate / 100)) // 21.99 * 1.23 = 27.0477 -> 27.05
    const lineTax = r2(lineGross * item.vat_rate / (100 + item.vat_rate)) // 27.05 * 23 / 123 = 5.0585 -> 5.06
    const lineTaxBase = r2(lineGross - lineTax) // 27.05 - 5.06 = 21.99
    return {
      ...item,
      line_total: lineNet,
      line_gross: lineGross,
      line_tax: lineTax,
      line_tax_base: lineTaxBase,
    }
  })
  const skGross = r2(skItems.reduce((sum, it) => sum + it.line_gross, 0)) // 270.50
  const skTax = r2(skGross * 23 / (100 + 23)) // 270.50 * 23 / 123 = 50.5772 -> 50.58
  const skTaxBase = r2(skGross - skTax) // 270.50 - 50.58 = 219.92

  // ─── Difference ───────────────────────────────────────────────────────────
  const taxBaseDiff = r2(skTaxBase - enTaxBase)
  const taxDiff = r2(skTax - enTax)
  const grossDiff = r2(skGross - enGross)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Porovnanie výpočtu DPH: EN16931 vs SK zákon
          </h1>
          <p className="text-muted-foreground">
            10 položiek, každá: množstvo = 3, cena = 7.33 EUR, DPH = 23%
          </p>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* EN16931 Forward Method */}
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-primary">EN16931 (Forward)</h2>
              <p className="text-xs text-muted-foreground">DPH = základ * sadzba / 100</p>
            </div>

            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Položky</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Popis</th>
                      <th className="pb-2 font-medium text-right">Mn.</th>
                      <th className="pb-2 font-medium text-right">Cena</th>
                      <th className="pb-2 font-medium text-right">Spolu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enItems.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-2 text-muted-foreground">{item.id}</td>
                        <td className="py-2 text-foreground">{item.description}</td>
                        <td className="py-2 text-right text-foreground">{item.quantity}</td>
                        <td className="py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                        <td className="py-2 text-right text-foreground font-medium">{fmt(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <Calculator className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Rekapitulácia DPH</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Sadzba</th>
                    <th className="pb-2 font-medium text-right">Základ dane</th>
                    <th className="pb-2 font-medium text-right">DPH</th>
                    <th className="pb-2 font-medium text-right">Spolu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">23%</td>
                    <td className="py-2 text-right text-foreground">{fmt(enTaxBase)}</td>
                    <td className="py-2 text-right text-foreground">{fmt(enTax)}</td>
                    <td className="py-2 text-right text-foreground font-medium">{fmt(enGross)}</td>
                  </tr>
                </tbody>
              </table>
            </GlassCard>

            <GlassCard heavy>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Základ dane:</span>
                  <span className="text-foreground font-mono">{fmt(enTaxBase)} EUR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">DPH 23%:</span>
                  <span className="text-foreground font-mono">{fmt(enTax)} EUR</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Celkom:</span>
                  <span className="text-xl font-bold text-primary font-mono">{fmt(enGross)} EUR</span>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <strong>Výpočet:</strong><br />
                Základ = 10 × (3 × 7.33) = 10 × 21.99 = {fmt(enTaxBase)}<br />
                DPH = {fmt(enTaxBase)} × 23% = {fmt(enTax)}<br />
                Celkom = {fmt(enTaxBase)} + {fmt(enTax)} = {fmt(enGross)}
              </div>
            </GlassCard>
          </div>

          {/* SK Reverse Method */}
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-success">SK zákon (Reverse)</h2>
              <p className="text-xs text-muted-foreground">DPH = brutto * sadzba / (100 + sadzba)</p>
            </div>

            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-success" />
                <h3 className="font-semibold text-foreground">Položky</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Popis</th>
                      <th className="pb-2 font-medium text-right">Netto</th>
                      <th className="pb-2 font-medium text-right">Brutto</th>
                      <th className="pb-2 font-medium text-right">DPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skItems.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-2 text-muted-foreground">{item.id}</td>
                        <td className="py-2 text-foreground">{item.description}</td>
                        <td className="py-2 text-right text-foreground">{fmt(item.line_total)}</td>
                        <td className="py-2 text-right text-foreground font-medium">{fmt(item.line_gross)}</td>
                        <td className="py-2 text-right text-success">{fmt(item.line_tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <Calculator className="w-5 h-5 text-success" />
                <h3 className="font-semibold text-foreground">Rekapitulácia DPH</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Sadzba</th>
                    <th className="pb-2 font-medium text-right">Základ dane</th>
                    <th className="pb-2 font-medium text-right">DPH</th>
                    <th className="pb-2 font-medium text-right">Spolu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">23%</td>
                    <td className="py-2 text-right text-foreground">{fmt(skTaxBase)}</td>
                    <td className="py-2 text-right text-foreground">{fmt(skTax)}</td>
                    <td className="py-2 text-right text-foreground font-medium">{fmt(skGross)}</td>
                  </tr>
                </tbody>
              </table>
            </GlassCard>

            <GlassCard heavy>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Základ dane:</span>
                  <span className="text-foreground font-mono">{fmt(skTaxBase)} EUR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">DPH 23%:</span>
                  <span className="text-foreground font-mono">{fmt(skTax)} EUR</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Celkom:</span>
                  <span className="text-xl font-bold text-success font-mono">{fmt(skGross)} EUR</span>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <strong>Výpočet:</strong><br />
                Brutto na riadok = 21.99 × 1.23 = 27.05 (zaokr.)<br />
                Brutto celkom = 10 × 27.05 = {fmt(skGross)}<br />
                DPH = {fmt(skGross)} × 23 / 123 = {fmt(skTax)}<br />
                Základ = {fmt(skGross)} - {fmt(skTax)} = {fmt(skTaxBase)}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Difference Summary */}
        <GlassCard className="border-warning/30">
          <div className="flex items-center gap-3 mb-4">
            <ArrowRight className="w-5 h-5 text-warning" />
            <h2 className="font-semibold text-foreground">Rozdiel medzi metódami</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground mb-1">Základ dane</div>
              <div className="text-lg font-mono">
                <span className="text-primary">{fmt(enTaxBase)}</span>
                <span className="text-muted-foreground mx-2">vs</span>
                <span className="text-success">{fmt(skTaxBase)}</span>
              </div>
              <div className={`text-sm font-medium mt-1 ${taxBaseDiff === 0 ? 'text-muted-foreground' : 'text-warning'}`}>
                Δ = {taxBaseDiff >= 0 ? '+' : ''}{fmt(taxBaseDiff)} EUR
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground mb-1">DPH</div>
              <div className="text-lg font-mono">
                <span className="text-primary">{fmt(enTax)}</span>
                <span className="text-muted-foreground mx-2">vs</span>
                <span className="text-success">{fmt(skTax)}</span>
              </div>
              <div className={`text-sm font-medium mt-1 ${taxDiff === 0 ? 'text-muted-foreground' : 'text-warning'}`}>
                Δ = {taxDiff >= 0 ? '+' : ''}{fmt(taxDiff)} EUR
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground mb-1">Celkom s DPH</div>
              <div className="text-lg font-mono">
                <span className="text-primary">{fmt(enGross)}</span>
                <span className="text-muted-foreground mx-2">vs</span>
                <span className="text-success">{fmt(skGross)}</span>
              </div>
              <div className={`text-sm font-medium mt-1 ${grossDiff === 0 ? 'text-muted-foreground' : 'text-warning'}`}>
                Δ = {grossDiff >= 0 ? '+' : ''}{fmt(grossDiff)} EUR
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-warning/10 text-sm text-warning">
            <strong>Záver:</strong> Pri 10 položkách s cenou 7.33 EUR vzniká rozdiel {fmt(Math.abs(grossDiff))} EUR 
            medzi EN16931 forward metódou a SK reverse metódou. V reálnych faktúrach sa tento rozdiel kompenzuje 
            pomocou AllowanceCharge (BG-20/BG-21), aby EN16931 validácia prešla.
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
