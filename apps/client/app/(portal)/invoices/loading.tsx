import { Skeleton } from '@/components/ui/skeleton'

export default function InvoicesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-36" />
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {[0, 1, 2].map(row => (
          <div key={row} className="p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
