import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />
}

/** Skeleton for a single invoice row in the list */
function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3.5 px-3">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-28 mb-1.5" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="text-right ml-4">
        <Skeleton className="h-4 w-20 mb-1.5 ml-auto" />
        <Skeleton className="h-5 w-14 ml-auto rounded-full" />
      </div>
    </div>
  )
}

/** Full invoice list skeleton with month header */
export function InvoiceListSkeleton() {
  return (
    <div className="space-y-2">
      {/* Month header */}
      <Skeleton className="h-4 w-28 mt-2 mb-1" />
      <div className="glass-card rounded-2xl divide-y divide-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <InvoiceRowSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-4 w-32 mt-6 mb-1" />
      <div className="glass-card rounded-2xl divide-y divide-border overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <InvoiceRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/** Invoice detail compact skeleton */
export function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-16 rounded-full ml-auto" />
      </div>
      <div className="glass-card rounded-2xl p-4">
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

/** Dashboard skeleton with search + supplier header */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48 mb-1" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <InvoiceListSkeleton />
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
