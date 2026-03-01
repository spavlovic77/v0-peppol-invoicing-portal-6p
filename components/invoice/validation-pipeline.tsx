'use client'

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
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
  isGenerating?: boolean
}

const PHASE_ICONS = [
  { label: 'XSD', color: 'primary' },
  { label: 'EN', color: 'chart-2' },
  { label: 'BIS', color: 'chart-3' },
]

export function ValidationPipeline({ phases, isGenerating }: Props) {
  const [revealedPhase, setRevealedPhase] = useState(-1)
  const [revealedRules, setRevealedRules] = useState<Record<number, number>>({})
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null)
  const animationRan = useRef(false)

  // Animate phases and rules cascading in
  useEffect(() => {
    if (!phases.length || animationRan.current) return
    animationRan.current = true

    let phaseIdx = 0

    function animatePhase() {
      if (phaseIdx >= phases.length) return

      setRevealedPhase(phaseIdx)
      const currentPhase = phases[phaseIdx]
      const rules = currentPhase.results
      let ruleIdx = 0

      const ruleInterval = setInterval(() => {
        if (ruleIdx >= rules.length) {
          clearInterval(ruleInterval)
          // Auto-expand failed phases
          if (!currentPhase.passed) {
            setExpandedPhase(phaseIdx)
          }
          phaseIdx++
          setTimeout(animatePhase, 300)
          return
        }
        setRevealedRules((prev) => ({ ...prev, [phaseIdx]: ruleIdx + 1 }))
        ruleIdx++
      }, 40)
    }

    // Start after a short delay
    const timer = setTimeout(animatePhase, 200)
    return () => clearTimeout(timer)
  }, [phases])

  const allPassed = phases.every((p) => p.passed)
  const totalRules = phases.reduce((s, p) => s + p.results.length, 0)
  const passedRules = phases.reduce(
    (s, p) => s + p.results.filter((r) => r.passed).length,
    0
  )
  const totalErrors = phases.reduce(
    (s, p) => s + p.results.filter((r) => !r.passed && r.severity === 'error').length,
    0
  )
  const totalWarnings = phases.reduce(
    (s, p) => s + p.results.filter((r) => !r.passed && r.severity === 'warning').length,
    0
  )
  const isFullyRevealed = revealedPhase >= phases.length - 1

  if (isGenerating) {
    return (
      <GlassCard className="border-primary/20">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <Loader2 className="w-5 h-5 text-primary animate-spin absolute -top-1 -right-1" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Generujem a validujem fakturu</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vytvaram UBL XML, kontrolujem XSD schema, EN16931 a Peppol BIS pravidla...
            </p>
          </div>
          {/* Animated pipeline preview */}
          <div className="flex items-center gap-3 mt-2">
            {PHASE_ICONS.map((phase, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${phase.color}/10 border border-${phase.color}/20`}>
                  <Loader2 className={`w-4 h-4 text-${phase.color} ${i === 0 ? 'animate-spin' : 'opacity-30'}`} />
                </div>
                {i < PHASE_ICONS.length - 1 && (
                  <div className="w-8 h-0.5 bg-border rounded" />
                )}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    )
  }

  if (!phases.length) return null

  // When all validations passed, show nothing -- the green status badge in the header is enough
  if (allPassed && isFullyRevealed) return null

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <GlassCard
        heavy
        className={
          allPassed && isFullyRevealed
            ? 'border-success/30'
            : !allPassed && isFullyRevealed
            ? 'border-destructive/30'
            : 'border-primary/20'
        }
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-500 ${
              !isFullyRevealed
                ? 'bg-primary/10'
                : allPassed
                ? 'bg-success/15'
                : 'bg-destructive/15'
            }`}
          >
            {!isFullyRevealed ? (
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            ) : allPassed ? (
              <CheckCircle2 className="w-7 h-7 text-success" />
            ) : (
              <XCircle className="w-7 h-7 text-destructive" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-lg">
              {!isFullyRevealed
                ? 'Validacia prebieha...'
                : allPassed
                ? 'Vsetky kontroly presli'
                : 'Najdene problemy'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {passedRules}/{totalRules} pravidiel splnenych
              {totalErrors > 0 && ` · ${totalErrors} chyb`}
              {totalWarnings > 0 && ` · ${totalWarnings} varovani`}
            </p>
          </div>

          {/* Phase progress dots */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {phases.map((phase, i) => {
              const revealed = i <= revealedPhase
              const fullyRevealed = (revealedRules[i] || 0) >= phase.results.length
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      !revealed
                        ? 'bg-secondary text-muted-foreground'
                        : fullyRevealed && phase.passed
                        ? 'bg-success/15 text-success'
                        : fullyRevealed && !phase.passed
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {fullyRevealed && phase.passed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : fullyRevealed && !phase.passed ? (
                      <XCircle className="w-4 h-4" />
                    ) : revealed ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < phases.length - 1 && (
                    <div
                      className={`w-6 h-0.5 rounded transition-colors duration-300 ${
                        fullyRevealed && phase.passed
                          ? 'bg-success/40'
                          : fullyRevealed
                          ? 'bg-destructive/40'
                          : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </GlassCard>

      {/* Phase cards */}
      {phases.map((phase, phaseIdx) => {
        const revealed = phaseIdx <= revealedPhase
        const rulesRevealed = revealedRules[phaseIdx] || 0
        const fullyRevealed = rulesRevealed >= phase.results.length
        const isOpen = expandedPhase === phaseIdx
        const errorCount = phase.results.filter(
          (r) => !r.passed && r.severity === 'error'
        ).length
        const warningCount = phase.results.filter(
          (r) => !r.passed && r.severity === 'warning'
        ).length
        const passedCount = phase.results.filter((r) => r.passed).length

        if (!revealed) {
          return (
            <GlassCard key={phaseIdx} className="opacity-30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">{phaseIdx + 1}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground text-sm">{phase.name}</h4>
                  <p className="text-xs text-muted-foreground/60">{phase.description}</p>
                </div>
              </div>
            </GlassCard>
          )
        }

        return (
          <GlassCard
            key={phaseIdx}
            className={`transition-all duration-300 ${
              fullyRevealed && phase.passed
                ? 'border-success/20'
                : fullyRevealed && !phase.passed
                ? 'border-destructive/20'
                : 'border-primary/20'
            }`}
          >
            {/* Phase header */}
            <button
              onClick={() => setExpandedPhase(isOpen ? null : phaseIdx)}
              className="w-full flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                    fullyRevealed && phase.passed
                      ? 'bg-success/15'
                      : fullyRevealed && !phase.passed
                      ? 'bg-destructive/15'
                      : 'bg-primary/15'
                  }`}
                >
                  {!fullyRevealed ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : phase.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      Faza {phaseIdx + 1}
                    </span>
                    <span className="font-semibold text-foreground text-sm">{phase.name}</span>
                    {phase.simulated && (
                      <span className="px-1.5 py-0.5 rounded-md bg-warning/20 text-warning text-xs font-medium">
                        OFFLINE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{phase.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {fullyRevealed && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {passedCount}/{phase.results.length}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                    {errorCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-bold">
                    {warningCount}
                  </span>
                )}
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Progress bar */}
            {!fullyRevealed && (
              <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${(rulesRevealed / phase.results.length) * 100}%` }}
                />
              </div>
            )}

            {/* Compact rule summary (when collapsed and fully revealed) */}
            {fullyRevealed && !isOpen && (
              <div className="mt-3 flex flex-wrap gap-1">
                {phase.results.map((rule, rIdx) => (
                  <div
                    key={rIdx}
                    className={`w-2.5 h-2.5 rounded-sm transition-all duration-200 ${
                      rule.passed
                        ? 'bg-success/40'
                        : rule.severity === 'error'
                        ? 'bg-destructive/60'
                        : 'bg-warning/60'
                    }`}
                    title={`[${rule.rule}] ${rule.message}`}
                  />
                ))}
              </div>
            )}

            {/* Expanded rules */}
            {isOpen && (
              <div className="mt-3 space-y-1 max-h-96 overflow-y-auto">
                {phase.results.slice(0, rulesRevealed).map((rule, ruleIdx) => (
                  <div
                    key={ruleIdx}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      rule.passed
                        ? 'bg-success/5'
                        : rule.severity === 'error'
                        ? 'bg-destructive/10'
                        : 'bg-warning/10'
                    }`}
                    style={{ animationDelay: `${ruleIdx * 30}ms` }}
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
                          rule.passed ? 'text-muted-foreground' : 'text-foreground'
                        }`}
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
