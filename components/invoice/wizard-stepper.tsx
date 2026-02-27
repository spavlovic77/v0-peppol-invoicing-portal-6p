import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  steps: string[]
  currentStep: number
}

export function InvoiceWizardStepper({ steps, currentStep }: Props) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors',
                  i < currentStep
                    ? 'bg-success text-success-foreground'
                    : i === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-sm hidden sm:block',
                  i === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-2',
                  i < currentStep ? 'bg-success' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
