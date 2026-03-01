'use client'

import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Shield, FlaskConical, Info } from 'lucide-react'
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
  simulated?: boolean
}

interface Props {
  phases: ValidationPhase[]
}

export function ValidationDisplay({ phases }: Props) {
  const [topOpen, setTopOpen] = useState(false)
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
  const isSimulated = phases.some((p) => p.simulated)
  const totalErrors = phases.reduce(
    (s, p) => s + p.results.filter((r) => !r.passed && r.severity === 'error').length,
    0
  )
  const totalWarnings = phases.reduce(
    (s, p) => s + p.results.filter((r) => !r.passed && r.severity === 'warning').length,
    0
  )

  return (
    <GlassCard className={allPassed ? 'border-success/20' : 'border-destructive/20'}>
      {/* Top-level accordion header */}
      <button
        onClick={() => setTopOpen(!topOpen)}
        className="w-full flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              allPassed ? 'bg-success/20' : 'bg-destructive/20'
            }`}
          >
            <Shield
              className={`w-5 h-5 ${allPassed ? 'text-success' : 'text-destructive'}`}
            />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground text-sm sm:text-base">
              {allPassed ? 'Faktúra je validná' : 'Faktúra obsahuje chyby'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {passedRules}/{totalRules} pravidiel splnených
              {totalErrors > 0 && ` · ${totalErrors} chýb`}
              {totalWarnings > 0 && ` · ${totalWarnings} varovaní`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allPassed ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive" />
          )}
          {topOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Simulation warning banner */}
      {isSimulated && (
        <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/10 border border-warning/30">
          <FlaskConical className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-warning">Simulácia validácie</p>
            <p className="text-xs text-muted-foreground">
              Schematron súbory nie sú skompilované a externá API je nedostupná. Výsledky sú orientačné — nespúšťajú sa skutočné PEPPOL pravidlá.
            </p>
          </div>
        </div>
      )}

      {/* How validation works */}
      {topOpen && (
        <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/50">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">Validacia prebieha v 4 fazach (kazda musi prejst pred dalsou):</p>
            <ol className="list-decimal list-inside space-y-0.5 pl-0.5">
              <li><span className="font-medium text-foreground/70">Strukturalna</span> -- povinne polia, formaty, datove typy (Zod schema)</li>
              <li><span className="font-medium text-foreground/70">UBL 2.1 XSD</span> -- poradie XML elementov podla OASIS UBL 2.1 schemy</li>
              <li><span className="font-medium text-foreground/70">EN 16931</span> -- obchodne pravidla EU (BR-*) podla CEN schematronu</li>
              <li><span className="font-medium text-foreground/70">Peppol BIS 3.0</span> -- pravidla OpenPEPPOL (PEPPOL-EN16931-R*) schematronu</li>
            </ol>
            <p className="pt-0.5">
              Primarne: <span className="font-mono text-[10px]">peppolvalidator.com</span> API (fazy 2-4).
              Fallback: JS simulacia s kontrolou poradia elementov.
            </p>
          </div>
        </div>
      )}

      {/* Expanded: show validation phases */}
      {topOpen && (
        <div className="mt-3 space-y-3">
          {phases.map((phase, phaseIdx) => {
            const isOpen = expanded[phaseIdx]
            const errorCount = phase.results.filter(
              (r) => !r.passed && r.severity === 'error'
            ).length
            const warningCount = phase.results.filter(
              (r) => !r.passed && r.severity === 'warning'
            ).length

            return (
              <div key={phaseIdx} className="rounded-xl bg-secondary/30 p-3">
                <button
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [phaseIdx]: !prev[phaseIdx] }))
                  }
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          Fáza {phaseIdx + 1}
                        </span>
                        <span className="font-medium text-foreground text-sm">
                          {phase.name}
                        </span>
                        {phase.simulated && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/20 text-warning text-xs font-medium">
                            <FlaskConical className="w-3 h-3" />
                            SIMULÁCIA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {phase.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {errorCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium">
                        {errorCount}
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
                        {warningCount}
                      </span>
                    )}
                    {phase.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-2.5 space-y-1">
                    {phase.results.map((rule, ruleIdx) => (
                      <div
                        key={ruleIdx}
                        className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-sm ${
                          rule.passed
                            ? 'bg-success/5'
                            : rule.severity === 'error'
                            ? 'bg-destructive/10'
                            : 'bg-warning/10'
                        }`}
                      >
                        {rule.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                        ) : rule.severity === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">
                            [{rule.rule}]
                          </span>
                          <span
                            className={`text-xs ${
                              rule.passed
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {rule.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
