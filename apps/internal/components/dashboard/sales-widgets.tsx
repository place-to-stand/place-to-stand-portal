'use client'

import Link from 'next/link'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import type { SalesHomeData, SalesLeadItem } from '@/lib/dashboard/sales-types'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { EmptyValue } from '@/components/table/empty-value'
import { RecordRowButton } from '@/components/ui/record-row-button'
import { LEAD_STATUS_LABELS } from '@/lib/leads/constants'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { WidgetCard } from './widget-card'

function describeDays(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

function LeadList({
  leads,
  emptyMessage,
  daysLabel,
}: {
  leads: SalesLeadItem[]
  emptyMessage: string
  daysLabel: string
}) {
  const { open } = useSheetParams()

  if (!leads.length) {
    return (
      <div className='p-4'>
        <EmptyState message={emptyMessage} />
      </div>
    )
  }

  return (
    <ul className='divide-y'>
      {leads.map(lead => (
        <li key={lead.id}>
          <RecordRowButton
            onClick={() => open('lead', lead.id)}
            title={lead.contactName}
            subtitle={`${lead.companyName ? `${lead.companyName} · ` : ''}${LEAD_STATUS_LABELS[lead.status]}`}
            trailing={
              <span className='shrink-0 text-right'>
                <span className='block text-sm font-semibold tabular-nums'>
                  {describeDays(lead.daysSinceTouch)}
                </span>
                <span className='text-muted-foreground block text-xs'>
                  {daysLabel}
                </span>
              </span>
            }
          />
        </li>
      ))}
    </ul>
  )
}

export function QuietLeadsWidget({
  data,
  className,
}: {
  data: SalesHomeData
  className?: string
}) {
  return (
    <WidgetCard
      id='quiet-leads'
      title='My aging leads'
      meta='Longest since contact first'
      className={className}
      action={
        <Button asChild size='xs' variant='outline'>
          <Link href='/leads?assignee=me' aria-label='See all your leads'>
            See all
          </Link>
        </Button>
      }
    >
      <LeadList
        leads={data.quietLeads}
        emptyMessage='No open leads assigned to you.'
        daysLabel='since contact'
      />
    </WidgetCard>
  )
}

export function PipelineWidget({
  data,
  className,
}: {
  data: SalesHomeData
  className?: string
}) {
  const total = data.pipeline.reduce((sum, stage) => sum + stage.total, 0)
  const mine = data.pipeline.reduce((sum, stage) => sum + stage.mine, 0)

  return (
    <WidgetCard
      id='pipeline'
      title='Leads pipeline'
      meta={`${total} open, ${mine} yours`}
      className={className}
      action={
        <Button asChild size='xs' variant='outline'>
          <Link href='/leads' aria-label='See all leads'>
            See all
          </Link>
        </Button>
      }
    >
      <ul className='divide-y'>
        {data.pipeline.map(stage => (
          <li
            key={stage.status}
            className='flex items-center justify-between gap-3 px-4 py-2.5'
          >
            <LeadStatusBadge status={stage.status} label={stage.label} />
            {/* A zero count is a dash, like every count column. */}
            {stage.total === 0 ? (
              <span className='text-sm'>
                <EmptyValue />
              </span>
            ) : (
              <span className='text-sm tabular-nums'>
                <span className='font-semibold'>{stage.total}</span>
                {stage.mine > 0 ? (
                  <span className='text-muted-foreground'>
                    {' '}
                    · {stage.mine} yours
                  </span>
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ul>
    </WidgetCard>
  )
}
