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

type CalendarHeaderProps = {
  headerRef: React.Ref<HTMLDivElement | null>
  currentMonth: Date
  monthValue: string
  yearValue: string
  onSelectMonth: (value: string) => void
  onYearChange: (value: string) => void
  onYearCommit: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onGoToToday: () => void
}

/**
 * The first of a local-calendar month as a date-only string, so
 * formatCalendarDate reads it back verbatim instead of shifting timezones.
 */
const toMonthStartKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`

const monthLabels = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: formatCalendarDate(toMonthStartKey(2025, index), { month: 'long' }),
}))

export function CalendarHeader({
  headerRef,
  currentMonth,
  monthValue,
  yearValue,
  onSelectMonth,
  onYearChange,
  onYearCommit,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}: CalendarHeaderProps) {
  return (
    <div
      ref={headerRef}
      className='bg-card sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl px-4 py-3 shadow-sm'
    >
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-lg font-semibold'>
            {formatCalendarDate(
              toMonthStartKey(
                currentMonth.getFullYear(),
                currentMonth.getMonth()
              ),
              { month: 'long', year: 'numeric' }
            )}
          </p>
        </div>
      </div>
      <div className='flex grow items-center justify-end gap-4'>
        <Button type='button' variant='outline' onClick={onGoToToday}>
          Today
        </Button>
        <div className='flex items-center gap-2'>
          <Select value={monthValue} onValueChange={onSelectMonth}>
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
              onYearCommit()
            }}
          >
            <Input
              value={yearValue}
              onChange={event => onYearChange(event.target.value)}
              onBlur={onYearCommit}
              inputMode='numeric'
              className='w-24'
              aria-label='Select year'
            />
          </form>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            onClick={onPrevMonth}
            aria-label='View previous month'
          >
            <ChevronLeft />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            onClick={onNextMonth}
            aria-label='View next month'
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
