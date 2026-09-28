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
  label: string
  cursor: MonthCursor
  minCursor: MonthCursor
  maxCursor: MonthCursor
  /** The month in progress today. */
  today: MonthCursor
  /** Closed periods as `${year}-${month}` (1-indexed). */
  closedPeriods: ReadonlySet<string>
  onSelect: (cursor: MonthCursor) => void
  onSelectToday: () => void
}

export function MonthPicker({
  label,
  cursor,
  minCursor,
  maxCursor,
  today,
  closedPeriods,
  onSelect,
  onSelectToday,
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
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            className='h-full rounded-none border-x px-3 font-medium'
          />
        }
      >
        {label}
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
            const notClosed =
              !outOfRange &&
              compareMonthCursor(target, today) < 0 &&
              !closedPeriods.has(`${target.year}-${target.month}`)

            return (
              <Button
                key={name}
                type='button'
                variant={isSelected ? 'default' : 'ghost'}
                disabled={outOfRange}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={
                  notClosed ? `${name} ${year}, not closed` : `${name} ${year}`
                }
                className={cn(
                  'relative font-normal',
                  isToday && !isSelected && 'border-input border'
                )}
                onClick={() => select(target)}
              >
                {name}
                {notClosed ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1.5 right-2 size-1.5 rounded-full',
                      isSelected ? 'bg-primary-foreground' : 'bg-foreground/60'
                    )}
                  />
                ) : null}
              </Button>
            )
          })}
        </div>
        <div className='mt-3 flex items-center justify-between border-t pt-2'>
          <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <span
              aria-hidden
              className='bg-foreground/60 size-1.5 rounded-full'
            />
            Not closed yet
          </span>
          <Button
            type='button'
            variant='link'
            size='xs'
            onClick={() => {
              setOpen(false)
              onSelectToday()
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
