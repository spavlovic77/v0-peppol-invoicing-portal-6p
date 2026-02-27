'use client'

import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Shield } from 'lucide-react'
import { useState } from 'react'
import { GlassCard } from '@/components/glass-card'

interface ValidationResult {
  rule: string
  severity: 'error' | 'warning'
  message: string
  passed: boolean
}

interface ValidationPhase {
  name: string
  description: string
  results: ValidationResult[]
  passed: boolean
}

interface Props {
  phases: ValidationPhase[]
}

export function ValidationDisplay({ phases }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {}
    phases.forEach((phase, i) => {
      initial[i] = !phase.passed
    })
    return initial
  })

  const totalRules = phases.reduce((s, p) => s + p.results.length, 0)
  const passedRules = phases.reduce(
    (s, p) => s + p.results.filter((r) => r.passed).length,
    0
  )
  const allPassed = phases.every((p) => p.passed)

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <GlassCard heavy>
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              allPassed ? 'bg-success/20' : 'bg-destructive/20'
            }`}
          >
            <Shield
              className={`w-6 h-6 ${allPassed ? 'text-success' : 'text-destructive'}`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {allPassed ? 'Faktura je validna' : 'Faktura obsahuje chyby'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {passedRules}/{totalRules} pravidiel splnenych v {phases.length} fazach
              validacie
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Phases */}
      {phases.map((phase, phaseIdx) => {
        const isOpen = expanded[phaseIdx]
        const errorCount = phase.results.filter(
          (r) => !r.passed && r.severity === 'error'
        ).length
        const warningCount = phase.results.filter(
          (r) => !r.passed && r.severity === 'warning'
        ).length

        return (
          <GlassCard key={phaseIdx}>
            <button
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [phaseIdx]: !prev[phaseIdx] }))
              }
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      Faza {phaseIdx + 1}
                    </span>
                    <span className="font-medium text-foreground">
                      {phase.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {phase.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium">
                    {errorCount} chyb
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
                    {warningCount} varov.
                  </span>
                )}
                {phase.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="mt-4 space-y-1.5">
                {phase.results.map((rule, ruleIdx) => (
                  <div
                    key={ruleIdx}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                      rule.passed
                        ? 'bg-success/5'
                        : rule.severity === 'error'
                        ? 'bg-destructive/10'
                        : 'bg-warning/10'
                    }`}
                  >
                    {rule.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    ) : rule.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        [{rule.rule}]
                      </span>
                      <span
                        className={
                          rule.passed
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        }
                      >
                        {rule.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}
