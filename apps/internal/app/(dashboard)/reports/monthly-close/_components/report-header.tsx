'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@pts/ui/dates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Input } from '@pts/ui/input'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useReportNavigation } from '@/lib/reports/use-report-navigation'
import type { MonthCursor } from '@/lib/data/reports/types'

const monthLabels = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label:
    formatCalendarDate(`2025-${String(index + 1).padStart(2, '0')}-01`, {
      month: 'long',
    }) ?? '',
}))

type ReportHeaderProps = {
  displayMonth: string
  minCursor: MonthCursor
  maxCursor: MonthCursor
  /** Close/reopen controls + status chip (PRD 002 section 04). */
  closeControls?: React.ReactNode
}

export function ReportHeader({
  displayMonth,
  minCursor,
  maxCursor,
  closeControls,
}: ReportHeaderProps) {
  const {
    monthValue,
    yearValue,
    setYearValue,
    selectMonth,
    commitYearChange,
    goToPrevMonth,
    goToNextMonth,
    goToThisMonth,
    canGoPrev,
    canGoNext,
    minLimitLabel,
    maxLimitLabel,
  } = useReportNavigation({ minCursor, maxCursor })

  const prevTooltipReason = !canGoPrev
    ? `No data before ${minLimitLabel}.`
    : null

  const nextTooltipReason = !canGoNext
    ? `No data beyond ${maxLimitLabel} yet.`
    : null

  return (
    <div className='bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm'>
      <div className='flex items-center gap-3'>
        <p className='text-lg font-semibold'>{displayMonth}</p>
        {closeControls}
      </div>
      <div className='flex grow items-center justify-end gap-4'>
        <Button type='button' variant='outline' onClick={goToThisMonth}>
          This month
        </Button>
        <div className='flex items-center gap-2'>
          <Select value={monthValue} onValueChange={selectMonth}>
            <SelectTrigger className='w-32'>
              <SelectValue aria-label='Select month' />
            </SelectTrigger>
            <SelectContent>
              {monthLabels.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form
            onSubmit={event => {
              event.preventDefault()
              commitYearChange()
            }}
          >
            <Input
              value={yearValue}
              onChange={event => setYearValue(event.target.value)}
              onBlur={commitYearChange}
              inputMode='numeric'
              className='w-24'
              aria-label='Select year'
            />
          </form>
        </div>
        <div className='flex items-center gap-2'>
          <DisabledFieldTooltip
            disabled={!canGoPrev}
            reason={prevTooltipReason}
          >
            <Button
              type='button'
              size='icon'
              variant='ghost'
              onClick={goToPrevMonth}
              disabled={!canGoPrev}
              aria-label='View previous month'
            >
              <ChevronLeft />
            </Button>
          </DisabledFieldTooltip>
          <DisabledFieldTooltip
            disabled={!canGoNext}
            reason={nextTooltipReason}
          >
            <Button
              type='button'
              size='icon'
              variant='ghost'
              onClick={goToNextMonth}
              disabled={!canGoNext}
              aria-label='View next month'
            >
              <ChevronRight />
            </Button>
          </DisabledFieldTooltip>
        </div>
      </div>
    </div>
  )
}
