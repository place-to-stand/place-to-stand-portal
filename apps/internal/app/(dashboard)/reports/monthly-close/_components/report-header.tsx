'use client'

import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useReportNavigation } from '@/lib/reports/use-report-navigation'
import type { MonthCursor } from '@/lib/data/reports/types'

const monthLabels = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2025, index, 1)
  return {
    value: String(index),
    label: format(date, 'MMMM'),
  }
})

type ReportHeaderProps = {
  displayMonth: string
  minCursor: MonthCursor
  maxCursor: MonthCursor
}

export function ReportHeader({
  displayMonth,
  minCursor,
  maxCursor,
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
      <div className='flex items-center'>
        <p className='text-lg font-semibold'>{displayMonth}</p>
      </div>
      <div className='flex grow items-center justify-end gap-4'>
        <Button type='button' variant='outline' onClick={goToThisMonth}>
          This Month
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
              <ChevronLeft className='h-4 w-4' />
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
              <ChevronRight className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </div>
      </div>
    </div>
  )
}
