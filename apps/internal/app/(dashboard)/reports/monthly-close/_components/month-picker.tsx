'use client'

import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { cn } from '@/lib/utils'
import type { MonthCursor } from '@/lib/data/reports/types'
import { compareMonthCursor } from '@/lib/reports/use-report-navigation'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

type MonthPickerProps = {
  cursor: MonthCursor
  minCursor: MonthCursor
  maxCursor: MonthCursor
  /** The month in progress today. */
  today: MonthCursor
  onSelect: (cursor: MonthCursor) => void
}

export function MonthPicker({
  cursor,
  minCursor,
  maxCursor,
  today,
  onSelect,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(cursor.year)

  const handleOpenChange = (next: boolean) => {
    if (next) setYear(cursor.year)
    setOpen(next)
  }

  const select = (target: MonthCursor) => {
    setOpen(false)
    onSelect(target)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {/* Three-letter month at a fixed width sized to the widest label
          ("May 2026"), so the stepper doesn't resize between months. */}
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            className='h-full w-30 rounded-none border-x px-3 font-medium tabular-nums'
          />
        }
      >
        {MONTHS[cursor.month - 1]} {cursor.year}
        <ChevronDown className='text-muted-foreground' />
      </PopoverTrigger>
      <PopoverContent className='w-72 p-3'>
        <div className='flex items-center justify-between'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Previous year'
            disabled={year <= minCursor.year}
            onClick={() => setYear(value => value - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className='text-sm font-medium tabular-nums'>{year}</span>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Next year'
            disabled={year >= maxCursor.year}
            onClick={() => setYear(value => value + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className='mt-2 grid grid-cols-3 gap-1'>
          {MONTHS.map((name, index) => {
            const target = { year, month: index + 1 }
            const outOfRange =
              compareMonthCursor(target, minCursor) < 0 ||
              compareMonthCursor(target, maxCursor) > 0
            const isSelected = compareMonthCursor(target, cursor) === 0
            const isToday = compareMonthCursor(target, today) === 0

            return (
              <Button
                key={name}
                type='button'
                variant={isSelected ? 'default' : 'ghost'}
                disabled={outOfRange}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`${name} ${year}`}
                className={cn(
                  'font-normal',
                  isToday && !isSelected && 'border-input border'
                )}
                onClick={() => select(target)}
              >
                {name}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
