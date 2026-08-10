'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Separator } from '@pts/ui/separator'
import { cn } from '@/lib/utils'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(value: number) {
  return HOURS_FORMATTER.format(value)
}

type ProjectBurndownWidgetProps = {
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  projectMonthToDateLoggedHours?: number
  className?: string
  onAddTimeLog: () => void
  showClientRemainingCard?: boolean
  showProjectMonthToDate?: boolean
}

/**
 * Slim single-line burndown strip sized to fit inside the PageShell header
 * without stretching it (user feedback on §01). The "View" link was dropped —
 * the Time Logs tab covers navigation.
 */
export function ProjectBurndownWidget({
  totalClientRemainingHours,
  totalProjectLoggedHours,
  projectMonthToDateLoggedHours = 0,
  className,
  onAddTimeLog,
  showClientRemainingCard = true,
  showProjectMonthToDate = false,
}: ProjectBurndownWidgetProps) {
  const projectLogged = Math.max(totalProjectLoggedHours, 0)
  const projectMonthToDateLogged = Math.max(projectMonthToDateLoggedHours, 0)
  const projectLoggedValue = showProjectMonthToDate
    ? projectMonthToDateLogged
    : projectLogged
  const projectHoursLabel = showProjectMonthToDate
    ? 'Project hours logged this month'
    : 'Project hours logged'
  const clientRemaining = totalClientRemainingHours

  return (
    <section
      className={cn('flex items-center gap-3', className)}
      aria-label='Burndown overview'
    >
      <dl className='hidden items-center gap-3 md:flex'>
        <Metric
          label={projectHoursLabel}
          value={`${formatHours(projectLoggedValue)} hrs`}
        />
        {showClientRemainingCard ? (
          <>
            <Separator orientation='vertical' className='h-4' />
            <Metric
              label='Client hours remaining'
              value={`${formatHours(clientRemaining)} hrs`}
              tone={clientRemaining < 0 ? 'destructive' : 'default'}
            />
          </>
        ) : null}
      </dl>
      <Button
        type='button'
        size='xs'
        variant='outline'
        onClick={onAddTimeLog}
        className='gap-1'
      >
        <Plus className='size-3' />
        Log time
      </Button>
    </section>
  )
}

type MetricProps = {
  label: string
  value: string
  tone?: 'default' | 'destructive'
}

function Metric({ label, value, tone = 'default' }: MetricProps) {
  return (
    <div className='flex items-baseline gap-1.5'>
      <dt className='text-muted-foreground text-[10px] font-semibold tracking-wider uppercase'>
        {label}
      </dt>
      <dd
        className={cn(
          'text-xs font-semibold tabular-nums',
          tone === 'destructive' ? 'text-destructive' : 'text-foreground'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
