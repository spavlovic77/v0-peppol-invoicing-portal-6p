import { GlassCard } from '@/components/glass-card'
import { CalendarDays, FileText, CreditCard } from 'lucide-react'

const paymentMethods = [
  { value: '30', label: 'Bankovy prevod' },
  { value: '58', label: 'SEPA prevod' },
  { value: '48', label: 'Platba kartou' },
  { value: '10', label: 'Hotovost' },
  { value: '42', label: 'Na ucet' },
  { value: '1', label: 'Nezadane / ine' },
]
import type { InvoiceFormData } from '@/lib/schemas'

interface Props {
  formData: InvoiceFormData
  updateForm: (u: Partial<InvoiceFormData>) => void
}

export function StepBasicInfo({ formData, updateForm }: Props) {
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Zakladne udaje faktury</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Cislo faktury *
            </label>
            <input
              id="invoice_number"
              type="text"
              value={formData.invoice_number}
              onChange={(e) => updateForm({ invoice_number: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="FV-2026-0001"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Automaticky generovane, mozete zmenit
            </p>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Mena</label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => updateForm({ currency: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            >
              <option value="EUR">EUR - Euro</option>
              <option value="CZK">CZK - Ceska koruna</option>
              <option value="USD">USD - Americky dolar</option>
              <option value="GBP">GBP - Britska libra</option>
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Forma uhrady</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Sposob platby</label>
            <select
              value={formData.payment_means_code}
              onChange={(e) => updateForm({ payment_means_code: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            >
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Variabilny symbol</label>
            <input
              type="text"
              value={formData.variable_symbol || ''}
              onChange={(e) => updateForm({ variable_symbol: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Variabilny symbol"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Datumy</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Datum vystavenia *
            </label>
            <input
              id="issue_date"
              type="date"
              value={formData.issue_date}
              onChange={(e) => updateForm({ issue_date: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Datum splatnosti *
            </label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => updateForm({ due_date: e.target.value })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Datum dodania
            </label>
            <input
              type="date"
              value={formData.delivery_date || ''}
              onChange={(e) => updateForm({ delivery_date: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Referencia objednavky
            </label>
            <input
              type="text"
              value={formData.order_reference || ''}
              onChange={(e) => updateForm({ order_reference: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Cislo objednavky"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Referencia odberatela
            </label>
            <input
              id="buyer_reference"
              type="text"
              value={formData.buyer_reference || ''}
              onChange={(e) => updateForm({ buyer_reference: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground"
              placeholder="Referencia odberatela"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted-foreground mb-1.5">
              Poznamka na fakture
            </label>
            <textarea
              value={formData.note || ''}
              onChange={(e) => updateForm({ note: e.target.value || null })}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-foreground resize-none"
              rows={2}
              placeholder="Volitelna poznamka..."
            />
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
