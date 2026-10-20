'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { MonthCursor } from '@/lib/data/reports/types'
import { cn } from '@/lib/utils'

import { formatDay } from './format'
import { MonthPicker } from './month-picker'
import { useReportNavigationContext } from './report-navigation'

type ReportToolbarProps = {
  minCursor: MonthCursor
  maxCursor: MonthCursor
  today: MonthCursor
  status: 'open' | 'closed'
  isCurrentMonth: boolean
  closedAt?: string
  closedByName?: string | null
  /** Shown instead of close controls for the month in progress. */
  closesAfterLabel: string
  closeControls: ReactNode
}

export function ReportToolbar({
  minCursor,
  maxCursor,
  today,
  status,
  isCurrentMonth,
  closedAt,
  closedByName,
  closesAfterLabel,
  closeControls,
}: ReportToolbarProps) {
  const {
    cursor,
    isPending,
    goToMonth,
    goToPrevMonth,
    goToNextMonth,
    goToThisMonth,
    canGoPrev,
    canGoNext,
    minLimitLabel,
    maxLimitLabel,
  } = useReportNavigationContext()

  const isViewingToday =
    cursor.year === today.year && cursor.month === today.month

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
            cursor={cursor}
            minCursor={minCursor}
            maxCursor={maxCursor}
            today={today}
            onSelect={goToMonth}
          />
          <Button
            type='button'
            variant='ghost'
            className='h-full rounded-none border-r px-3 font-normal'
            onClick={goToThisMonth}
            disabled={isViewingToday}
          >
            Today
          </Button>
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

        {/* The badge and close controls describe the month on screen, which
            is the previous one until the new report arrives. */}
        {isPending ? (
          <span
            role='status'
            className='text-muted-foreground flex items-center gap-2 text-sm'
          >
            <Loader2 className='size-4 animate-spin motion-reduce:animate-none' />
            Loading…
          </span>
        ) : status === 'closed' ? (
          <>
            <Badge variant='outline'>
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
          <Badge variant='outline'>Open</Badge>
        )}
      </div>

      <div
        inert={isPending}
        className={cn(
          'transition-opacity duration-200 motion-reduce:transition-none',
          isPending && 'opacity-50'
        )}
      >
        {status === 'open' && isCurrentMonth ? (
          <span className='text-muted-foreground text-sm'>
            {closesAfterLabel}
          </span>
        ) : (
          closeControls
        )}
      </div>
    </div>
  )
}
