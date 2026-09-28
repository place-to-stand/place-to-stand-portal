'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { MonthCursor } from '@/lib/data/reports/types'
import { useReportNavigation } from '@/lib/reports/use-report-navigation'

import { formatDay } from './format'
import { MonthPicker } from './month-picker'

type ReportToolbarProps = {
  displayMonth: string
  minCursor: MonthCursor
  maxCursor: MonthCursor
  today: MonthCursor
  closedPeriods: string[]
  status: 'open' | 'closed'
  isCurrentMonth: boolean
  closedAt?: string
  closedByName?: string | null
  /** Shown instead of close controls for the month in progress. */
  closesAfterLabel: string
  closeControls: ReactNode
}

export function ReportToolbar({
  displayMonth,
  minCursor,
  maxCursor,
  today,
  closedPeriods,
  status,
  isCurrentMonth,
  closedAt,
  closedByName,
  closesAfterLabel,
  closeControls,
}: ReportToolbarProps) {
  const {
    cursor,
    goToMonth,
    goToPrevMonth,
    goToNextMonth,
    goToThisMonth,
    canGoPrev,
    canGoNext,
    minLimitLabel,
    maxLimitLabel,
  } = useReportNavigation({ minCursor, maxCursor })

  const closedMeta = [
    closedAt ? formatDay(closedAt) : null,
    closedByName ? `by ${closedByName}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='bg-background dark:bg-input/30 flex h-9 items-center overflow-hidden rounded-md border shadow-xs'>
          <DisabledFieldTooltip
            disabled={!canGoPrev}
            reason={canGoPrev ? null : `No data before ${minLimitLabel}.`}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='rounded-none'
              onClick={goToPrevMonth}
              disabled={!canGoPrev}
              aria-label='Previous month'
            >
              <ChevronLeft />
            </Button>
          </DisabledFieldTooltip>
          <MonthPicker
            label={displayMonth}
            cursor={cursor}
            minCursor={minCursor}
            maxCursor={maxCursor}
            today={today}
            closedPeriods={new Set(closedPeriods)}
            onSelect={goToMonth}
            onSelectToday={goToThisMonth}
          />
          <DisabledFieldTooltip
            disabled={!canGoNext}
            reason={canGoNext ? null : `No data beyond ${maxLimitLabel} yet.`}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='rounded-none'
              onClick={goToNextMonth}
              disabled={!canGoNext}
              aria-label='Next month'
            >
              <ChevronRight />
            </Button>
          </DisabledFieldTooltip>
        </div>

        {status === 'closed' ? (
          <>
            <Badge variant='secondary'>
              <Lock />
              Closed
            </Badge>
            {closedMeta ? (
              <span className='text-muted-foreground text-xs'>
                {closedMeta}
              </span>
            ) : null}
          </>
        ) : isCurrentMonth ? (
          <Badge variant='outline'>In progress</Badge>
        ) : (
          <Badge variant='secondary'>Open</Badge>
        )}
      </div>

      {status === 'open' && isCurrentMonth ? (
        <span className='text-muted-foreground text-sm'>
          {closesAfterLabel}
        </span>
      ) : (
        closeControls
      )}
    </div>
  )
}
