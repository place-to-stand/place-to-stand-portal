import { Skeleton } from '@/components/ui/skeleton'

export default function HoursLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  )
}
