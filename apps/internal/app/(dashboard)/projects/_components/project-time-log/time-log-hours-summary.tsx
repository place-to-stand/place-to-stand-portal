'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@pts/ui/cn'
import { formatHours } from '@pts/ui/numbers'
import { Skeleton } from '@pts/ui/skeleton'
import { ENTITY_ICONS, entityIconAccent } from '@/lib/entity-accents'
import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { StatCard } from '@/components/ui/stat-card'
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
    return <Skeleton className='h-[150px] w-full rounded-lg' />
  }

  if (!data) {
    return (
      <div className={BOX}>
        <Line icon={ENTITY_ICONS.project}>{projectLabel}</Line>
      </div>
    )
  }

  const net30 = data.billingType === 'net_30'
  const clientHours = net30 ? data.clientThisMonth : data.clientRemaining

  return (
    <div className='flex flex-col gap-3'>
      {/* The icons say client and project; the badge says how it's billed. */}
      <div className={BOX}>
        <Line icon={ENTITY_ICONS.client}>
          <span className='truncate'>{data.clientName}</span>
          <BillingTypeBadge billingType={data.billingType} />
        </Line>
        <Line icon={ENTITY_ICONS.project}>{data.projectName}</Line>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <StatCard
          label={net30 ? 'Project this month' : 'Project logged'}
          value={formatHours(data.projectHours)}
        />
        <StatCard
          label={net30 ? 'Client this month' : 'Client remaining'}
          value={formatHours(clientHours ?? 0)}
          tone={!net30 && (clientHours ?? 0) < 0 ? 'negative' : 'default'}
        />
      </div>
    </div>
  )
}

const BOX =
  'bg-muted/40 flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-sm'

function Line({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <Icon
        className={cn(
          'size-4 shrink-0',
          entityIconAccent(Icon) ?? 'text-muted-foreground'
        )}
        aria-hidden
      />
      {children}
    </div>
  )
}
