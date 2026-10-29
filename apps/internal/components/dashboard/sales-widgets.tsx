'use client'

import Link from 'next/link'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import type {
  SalesHomeData,
  SalesLeadItem,
  SalesTaskItem,
} from '@/lib/dashboard/sales-types'
import { getLeadStatusToken, LEAD_STATUS_LABELS } from '@/lib/leads/constants'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

import { WidgetCard } from './widget-card'

const ROW_CLASS =
  'hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none'

/** "Due today", "3 days late", "Due Fri, Nov 6". */
function describeDue(dueOn: string, today: string) {
  const dayMs = 24 * 60 * 60 * 1000
  const diff = Math.round(
    (Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs
  )
  if (diff === 0) return { label: 'Due today', tone: 'today' as const }
  if (diff < 0) {
    const late = -diff
    return {
      label: `${late} ${late === 1 ? 'day' : 'days'} late`,
      tone: 'late' as const,
    }
  }
  if (diff === 1) return { label: 'Due tomorrow', tone: 'soon' as const }
  const label = new Date(`${dueOn}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return { label: `Due ${label}`, tone: 'later' as const }
}

function describeDays(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function NextStepsWidget({
  data,
  className,
}: {
  data: SalesHomeData
  className?: string
}) {
  const { open } = useSheetParams()
  const items = data.nextSteps

  return (
    <WidgetCard
      id='next-steps'
      title='Next steps'
      className={className}
      meta={`${items.length} of ${data.nextStepsTotal} open`}
      action={
        <Button asChild size='xs' variant='outline'>
          <Link href='/my/tasks/board' aria-label='View all my tasks'>
            See all
          </Link>
        </Button>
      }
    >
      {items.length ? (
        <ul className='divide-y'>
          {items.map(task => (
            <li key={task.id}>
              <TaskRow
                task={task}
                today={data.today}
                onOpen={() => open('task', task.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className='p-4'>
          <EmptyState message='Nothing on your plate. Add a task from a lead to plan the next step.' />
        </div>
      )}
    </WidgetCard>
  )
}

function TaskRow({
  task,
  today,
  onOpen,
}: {
  task: SalesTaskItem
  today: string
  onOpen: () => void
}) {
  const due = task.dueOn ? describeDue(task.dueOn, today) : null

  return (
    <button type='button' className={ROW_CLASS} onClick={onOpen}>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-medium'>{task.title}</span>
        <span className='text-muted-foreground block truncate text-xs'>
          {task.leadName ? `${task.leadName} · ` : ''}
          {task.projectName}
        </span>
      </span>
      {due ? (
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            due.tone === 'late' && 'text-destructive',
            due.tone === 'today' && 'text-amber-600 dark:text-amber-400',
            (due.tone === 'soon' || due.tone === 'later') &&
              'text-muted-foreground'
          )}
        >
          {due.label}
        </span>
      ) : (
        <span className='text-muted-foreground shrink-0 text-xs'>No date</span>
      )}
    </button>
  )
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
          <button
            type='button'
            className={ROW_CLASS}
            onClick={() => open('lead', lead.id)}
          >
            <span className='min-w-0 flex-1'>
              <span className='block truncate text-sm font-medium'>
                {lead.contactName}
              </span>
              <span className='text-muted-foreground block truncate text-xs'>
                {lead.companyName ? `${lead.companyName} · ` : ''}
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
            </span>
            <span className='shrink-0 text-right'>
              <span className='block text-sm font-semibold tabular-nums'>
                {describeDays(lead.daysSinceTouch)}
              </span>
              <span className='text-muted-foreground block text-xs'>
                {daysLabel}
              </span>
            </span>
          </button>
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
      title='Leads gone quiet'
      meta='Your leads, longest silence first'
      className={className}
    >
      <LeadList
        leads={data.quietLeads}
        emptyMessage='No open leads assigned to you.'
        daysLabel='since last touch'
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
      title='Pipeline'
      meta={`${total} open, ${mine} yours`}
      className={className}
      action={
        <Button asChild size='xs' variant='outline'>
          <Link href='/leads' aria-label='Open the leads board'>
            Board
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
            <Badge
              variant='outline'
              className={cn(
                'text-xs font-semibold tracking-wide uppercase',
                getLeadStatusToken(stage.status)
              )}
            >
              {stage.label}
            </Badge>
            <span className='text-sm tabular-nums'>
              <span className='font-semibold'>{stage.total}</span>
              <span className='text-muted-foreground'>
                {' '}
                · {stage.mine} yours
              </span>
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  )
}
