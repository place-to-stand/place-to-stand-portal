import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  )
}
