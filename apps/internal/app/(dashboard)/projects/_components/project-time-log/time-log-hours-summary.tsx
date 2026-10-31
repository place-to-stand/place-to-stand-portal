'use client'

import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@pts/ui/cn'
import { formatHours } from '@pts/ui/numbers'
import { Skeleton } from '@pts/ui/skeleton'
import { ENTITY_ICONS, entityIconAccent } from '@/lib/entity-accents'
import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelStats,
} from '@/components/ui/info-panel'
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
  variant = 'panel',
}: {
  /**
   * TEMPORARY comparison (drop with its commit): 'band' is the alternate
   * full-width strip under the dialog title; 'panel' is the current one.
   */
  variant?: TimeLogInfoVariant
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
    return variant === 'band' ? (
      <Skeleton className='-mx-6 -mt-4 h-[68px] rounded-none' />
    ) : (
      <Skeleton className='h-[138px] w-full rounded-lg' />
    )
  }

  if (!data) {
    return <TimeLogInfoView variant={variant} projectName={projectLabel} />
  }

  const net30 = data.billingType === 'net_30'
  const clientHours = net30 ? data.clientThisMonth : data.clientRemaining

  return (
    <TimeLogInfoView
      variant={variant}
      clientName={data.clientName}
      billingType={data.billingType}
      projectName={data.projectName}
      stats={[
        {
          label: net30 ? 'Project this month' : 'Project logged',
          value: formatHours(data.projectHours),
        },
        {
          label: net30 ? 'Client this month' : 'Client remaining',
          value: formatHours(clientHours ?? 0),
          negative: !net30 && (clientHours ?? 0) < 0,
        },
      ]}
    />
  )
}

export type TimeLogInfoVariant = 'panel' | 'band'

type TimeLogStat = { label: string; value: string; negative?: boolean }

/**
 * The time log's context, drawn either way. 'panel': one read-only panel,
 * the names then the figures, never bordered like the inputs below it.
 * 'band' (TEMPORARY, for comparison): a tinted strip edge to edge under the
 * dialog title, names on the left and the two figures as quiet stats on the
 * right, a hairline under it, then the form.
 */
export function TimeLogInfoView({
  variant,
  clientName,
  billingType,
  projectName,
  stats,
}: {
  variant: TimeLogInfoVariant
  clientName?: string
  billingType?: ComponentProps<typeof BillingTypeBadge>['billingType']
  projectName: string
  stats?: TimeLogStat[]
}) {
  const names = (
    <>
      {clientName ? (
        <Line icon={ENTITY_ICONS.client}>
          <span className='truncate'>{clientName}</span>
          {billingType ? <BillingTypeBadge billingType={billingType} /> : null}
        </Line>
      ) : null}
      <Line icon={ENTITY_ICONS.project}>{projectName}</Line>
    </>
  )

  if (variant === 'band') {
    return (
      // -mx-6 -mt-4: edge to edge, tucked under the title (the dialog's p-6
      // and gap-4).
      <div className='bg-muted/40 border-border/70 -mx-6 -mt-4 flex items-center justify-between gap-6 border-y px-6 py-3 text-sm'>
        <div className='flex min-w-0 flex-col gap-1.5'>{names}</div>
        {stats?.length ? (
          <dl className='flex shrink-0 gap-6 text-right'>
            {stats.map(stat => (
              <div key={stat.label} className='flex flex-col gap-0.5'>
                <dt className='text-muted-foreground text-xs'>{stat.label}</dt>
                <dd
                  className={cn(
                    'font-medium tabular-nums',
                    stat.negative && 'text-destructive'
                  )}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    )
  }

  return (
    <InfoPanel>
      <InfoPanelBody>{names}</InfoPanelBody>
      {stats?.length ? <InfoPanelStats stats={stats} /> : null}
    </InfoPanel>
  )
}

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
