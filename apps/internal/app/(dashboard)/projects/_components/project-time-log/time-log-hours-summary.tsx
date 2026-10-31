'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@pts/ui/cn'
import { formatHours } from '@pts/ui/numbers'
import { Skeleton } from '@pts/ui/skeleton'
import { ENTITY_ICONS, entityIconAccent } from '@/lib/entity-accents'
import { loadTimeLogHours } from '@/lib/projects/time-log/load-time-log-hours'

export const TIME_LOG_HOURS_QUERY_KEY = 'time-log-hours' as const

/**
 * The top of every time-log dialog (create and edit, from every entry
 * point): the client, the project and its billing type, then the hours, as
 * label / value rows like the record cards. Prepaid clients show the hours
 * left on their blocks; Net 30 clients show this month's hours. Internal and
 * personal projects (no client) show just the project.
 */
export function TimeLogHoursSummary({
  projectId,
  projectLabel,
  isClientProject,
}: {
  projectId: string
  /** Shown alone for a project with no client. */
  projectLabel: string
  isClientProject: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: [TIME_LOG_HOURS_QUERY_KEY, projectId],
    queryFn: () => loadTimeLogHours(projectId),
    enabled: isClientProject,
    staleTime: 0,
    // Dropped when the dialog closes: reopening shows fresh numbers, never
    // the previous ones while it refetches.
    gcTime: 0,
  })

  if (isClientProject && isLoading) {
    return <Skeleton className='h-[116px] w-full rounded-lg' />
  }

  if (!data) {
    return (
      <dl className={BOX}>
        <Row icon={ENTITY_ICONS.project} label='Project'>
          {projectLabel}
        </Row>
      </dl>
    )
  }

  const net30 = data.billingType === 'net_30'
  const clientHours = net30 ? data.clientThisMonth : data.clientRemaining

  return (
    <dl className={BOX}>
      <Row icon={ENTITY_ICONS.client} label='Client'>
        {data.clientName}
      </Row>
      <Row icon={ENTITY_ICONS.project} label='Project'>
        {data.projectName}
      </Row>
      <Row label='Billing'>{net30 ? 'Net 30' : 'Prepaid'}</Row>
      <Row label={net30 ? 'Project this month' : 'Project logged'}>
        <span className='font-semibold tabular-nums'>
          {formatHours(data.projectHours)}
        </span>
      </Row>
      <Row label={net30 ? 'Client this month' : 'Client remaining'}>
        <span
          className={cn(
            'font-semibold tabular-nums',
            !net30 && (clientHours ?? 0) < 0 && 'text-destructive'
          )}
        >
          {formatHours(clientHours ?? 0)}
        </span>
      </Row>
    </dl>
  )
}

const BOX =
  'bg-muted/40 grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 rounded-lg border px-4 py-3 text-sm'

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon?: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <>
      <dt className='text-muted-foreground flex items-center gap-2'>
        {Icon ? (
          <Icon
            className={cn(
              'size-4 shrink-0',
              entityIconAccent(Icon) ?? 'text-muted-foreground'
            )}
            aria-hidden
          />
        ) : null}
        {label}
      </dt>
      <dd className='min-w-0 truncate'>{children}</dd>
    </>
  )
}
