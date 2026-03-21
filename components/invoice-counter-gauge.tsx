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

    const duration = 2000 // 2 seconds
    const startTime = performance.now()
    const startValue = 0

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function - ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      
      const currentValue = Math.round(startValue + (count - startValue) * eased)
      setDisplayCount(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [loading, count])

  // Calculate needle rotation (0-180 degrees for semicircle)
  // Max scale: let's say 1000 invoices = full gauge
  const maxScale = Math.max(1000, count * 1.5)
  const needleRotation = Math.min((displayCount / maxScale) * 180, 180)

  // Gradient colors for the gauge arc
  const gradientId = 'gauge-gradient'

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative w-64 h-36">
        {/* SVG Gauge */}
        <svg
          viewBox="0 0 200 110"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Gradient for the arc */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background arc (track) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-border/30"
          />

          {/* Colored arc (progress) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 - (251.2 * Math.min(displayCount / maxScale, 1))}
            style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
            filter="url(#glow)"
          />

          {/* Tick marks */}
          {[0, 45, 90, 135, 180].map((angle) => {
            const radian = (angle * Math.PI) / 180
            const x1 = 100 - Math.cos(radian) * 70
            const y1 = 100 - Math.sin(radian) * 70
            const x2 = 100 - Math.cos(radian) * 60
            const y2 = 100 - Math.sin(radian) * 60
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-muted-foreground/40"
              />
            )
          })}

          {/* Needle */}
          <g
            style={{
              transform: `rotate(${needleRotation}deg)`,
              transformOrigin: '100px 100px',
              transition: 'transform 0.1s ease-out',
            }}
          >
            {/* Needle shape */}
            <polygon
              points="100,30 96,100 100,95 104,100"
              className="fill-primary"
              filter="url(#glow)"
            />
            {/* Needle center cap */}
            <circle
              cx="100"
              cy="100"
              r="8"
              className="fill-primary"
            />
            <circle
              cx="100"
              cy="100"
              r="4"
              className="fill-background"
            />
          </g>
        </svg>

        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className="text-center">
            {loading ? (
              <div className="w-16 h-8 bg-muted/30 rounded animate-pulse" />
            ) : (
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {displayCount.toLocaleString('sk-SK')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm text-muted-foreground mt-2">
        {loading ? 'Nacitavam...' : 'vygenerovanych faktur'}
      </p>
    </div>
  )
}
