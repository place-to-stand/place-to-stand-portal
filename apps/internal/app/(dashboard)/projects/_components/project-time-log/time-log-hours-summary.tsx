'use client'

import { useQuery } from '@tanstack/react-query'

import { cn } from '@pts/ui/cn'
import { formatHours } from '@pts/ui/numbers'
import { Skeleton } from '@pts/ui/skeleton'
import { loadTimeLogHours } from '@/lib/projects/time-log/load-time-log-hours'

export const TIME_LOG_HOURS_QUERY_KEY = 'time-log-hours' as const

/**
 * The project's and its client's hours, shown at the top of every time-log
 * dialog (create and edit, from every entry point). Prepaid clients show
 * the hours left on their blocks; Net 30 clients show this month's hours.
 * Internal and personal projects have no client, so nothing renders.
 */
export function TimeLogHoursSummary({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: [TIME_LOG_HOURS_QUERY_KEY, projectId],
    queryFn: () => loadTimeLogHours(projectId),
    staleTime: 0,
  })

  if (isLoading) {
    return <Skeleton className='h-[62px] w-full rounded-lg' />
  }

  if (!data) {
    return null
  }

  const net30 = data.billingType === 'net_30'
  const clientHours = net30 ? data.clientThisMonth : data.clientRemaining

  return (
    <dl className='bg-muted/40 grid grid-cols-2 gap-3 rounded-lg border px-4 py-3'>
      <div>
        <dt className='text-muted-foreground text-xs'>
          {net30 ? 'Project hours this month' : 'Project hours logged'}
        </dt>
        <dd className='text-sm font-semibold tabular-nums'>
          {formatHours(data.projectHours)}
        </dd>
      </div>
      <div>
        <dt className='text-muted-foreground truncate text-xs'>
          {net30
            ? `${data.clientName} hours this month`
            : `${data.clientName} hours remaining`}
        </dt>
        <dd
          className={cn(
            'text-sm font-semibold tabular-nums',
            !net30 && (clientHours ?? 0) < 0 && 'text-destructive'
          )}
        >
          {formatHours(clientHours ?? 0)}
        </dd>
      </div>
    </dl>
  )
}
