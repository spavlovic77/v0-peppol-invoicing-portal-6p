'use client'

import { useEffect, useState, useRef } from 'react'

interface InvoiceCounterGaugeProps {
  className?: string
}

export function InvoiceCounterGauge({ className = '' }: InvoiceCounterGaugeProps) {
  const [count, setCount] = useState(0)
  const [displayCount, setDisplayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const animationRef = useRef<number | null>(null)

  // Fetch the real count
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/stats/invoice-count')
        const data = await res.json()
        setCount(data.count || 0)
      } catch {
        setCount(0)
      } finally {
        setLoading(false)
      }
    }
    fetchCount()
  }, [])

  // Animate count up
  useEffect(() => {
    if (loading || count === 0) return

    const duration = 2000
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCount(Math.round(count * eased))

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [loading, count])

  // Pad to 6 digits for odometer look
  const digits = String(displayCount).padStart(6, '0').split('')

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Odometer digits */}
      <div className="flex gap-0.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-12 bg-zinc-900 rounded border border-zinc-700 animate-pulse"
            />
          ))
        ) : (
          digits.map((digit, i) => (
            <div
              key={i}
              className="w-8 h-12 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center"
            >
              <span className="text-2xl font-mono font-bold text-white">
                {digit}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Label */}
      <p className="text-xs text-muted-foreground mt-3">
        ste už vytvorili. Trénujte viac! :)
      </p>
    </div>
  )
}
