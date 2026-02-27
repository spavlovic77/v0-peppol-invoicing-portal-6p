import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />
}

/** Skeleton for a stat card matching GlassCard shape */
export function StatCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

/** Skeleton for a table row */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-1">
          <Skeleton className={cn('h-4', i === 0 ? 'w-24' : i === cols - 1 ? 'w-10' : 'w-20')} />
        </td>
      ))}
    </tr>
  )
}

/** Full dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-10 w-full rounded-xl mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRowSkeleton key={i} cols={6} />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for supplier form fields */
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
      <div className="glass-card rounded-2xl p-6">
        <Skeleton className="h-5 w-32 mb-6" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton for supplier list cards */
export function SupplierCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}
