import { Skeleton } from '@pts/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className='space-y-6'>
      {/* Title (client name) + the one-line description under it. */}
      <div className='space-y-2'>
        <Skeleton className='h-9 w-48' />
        {/* Two near-equal bars: the real copy is text-balance, so when it wraps
            it wraps into even lines rather than a long one and a stub. */}
        <Skeleton className='h-4 w-96 max-w-full' />
        <Skeleton className='h-4 w-88 max-w-full' />
      </div>

      <div className='dash:grid-cols-2 grid items-start gap-6'>
        {/* Account: hours rows + the invoices row */}
        <Skeleton className='h-44 w-full rounded-xl' />
        {/* Projects */}
        <Skeleton className='h-32 w-full rounded-xl' />
      </div>
    </div>
  )
}
