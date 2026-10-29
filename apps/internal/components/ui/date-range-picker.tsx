'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Calendar } from '@pts/ui/calendar'
import { formatCalendarDate } from '@pts/ui/dates'
import { useIsMobile } from '@pts/ui/hooks/use-mobile'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { focusCalendarDay } from '@/components/ui/date-picker'
import { fieldTriggerClasses } from '@/components/ui/searchable-combobox'
import {
  DATE_RANGE_PRESETS,
  matchDateRangePreset,
  parseCalendarDate,
  resolveDateRangePreset,
  toCalendarDate,
  WEEK_STARTS_ON,
  type CalendarDateRange,
} from '@/lib/dates/calendar-date'
import { cn } from '@/lib/utils'

/** A calendar selection in progress: the end is unset until it is picked. */
type DateRange = { from: Date | undefined; to?: Date | undefined }

type DateRangePickerProps = {
  /** Inclusive `YYYY-MM-DD` bounds. */
  value: CalendarDateRange
  onChange: (value: CalendarDateRange) => void
  /** Names the trigger for screen readers ("Date range"). */
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Date-range filter: a combobox-style trigger opening preset shortcuts
 * (Today … Last year) beside a two-month calendar. A preset applies at once;
 * on the calendar the first click starts a range and the second completes
 * and applies it. The trigger names the matching preset, or the dates when
 * the range is custom.
 */
export function DateRangePicker({
  value,
  onChange,
  ariaLabel = 'Date range',
  disabled,
  className,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const committed = React.useMemo<DateRange>(
    () => ({
      from: parseCalendarDate(value.from),
      to: parseCalendarDate(value.to),
    }),
    [value.from, value.to]
  )
  // The in-progress selection while the popover is open: a half-picked
  // range (start only) lives here until the end day is chosen.
  const [draft, setDraft] = React.useState<DateRange | undefined>(committed)

  const preset = matchDateRangePreset(value)
  const presetLabel = DATE_RANGE_PRESETS.find(p => p.key === preset)?.label
  const datesLabel = formatRange(value)

  const handleOpenChange = (next: boolean) => {
    if (disabled) return
    if (next) setDraft(committed)
    setOpen(next)
  }

  const apply = (range: CalendarDateRange) => {
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          aria-haspopup='dialog'
          aria-expanded={open}
          aria-label={`${ariaLabel}: ${presetLabel ? `${presetLabel}, ` : ''}${datesLabel}`}
          title={datesLabel}
          disabled={disabled}
          className={cn(fieldTriggerClasses, 'w-56', className)}
        >
          <span className='flex min-w-0 items-center gap-2'>
            <CalendarIcon className='size-4 shrink-0 opacity-50' />
            <span className='min-w-0 truncate font-medium'>
              {presetLabel ?? datesLabel}
            </span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='flex w-auto max-w-[calc(100vw-2rem)] flex-col p-0 sm:flex-row'
        sideOffset={8}
        initialFocus={focusCalendarDay}
      >
        <div
          role='group'
          aria-label='Presets'
          className='grid grid-cols-2 gap-1 border-b p-2 sm:flex sm:w-36 sm:flex-col sm:border-r sm:border-b-0'
        >
          {DATE_RANGE_PRESETS.map(option => (
            <Button
              key={option.key}
              type='button'
              variant='ghost'
              size='sm'
              aria-pressed={preset === option.key}
              onClick={() => apply(resolveDateRangePreset(option.key))}
              className={cn(
                'justify-start font-normal',
                preset === option.key && 'bg-accent text-accent-foreground'
              )}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            aria-pressed={preset === null}
            // Custom is the calendar itself: this just moves focus there.
            onClick={() => {
              const day = focusCalendarDay()
              if (day instanceof HTMLElement) day.focus()
            }}
            className={cn(
              'justify-start font-normal',
              preset === null && 'bg-accent text-accent-foreground'
            )}
          >
            Custom
          </Button>
        </div>
        <Calendar
          mode='range'
          resetOnSelect
          numberOfMonths={isMobile ? 1 : 2}
          defaultMonth={isMobile ? committed.to : committed.from}
          weekStartsOn={WEEK_STARTS_ON}
          selected={draft}
          onSelect={range => {
            setDraft(range)
            if (range?.from && range.to) {
              apply({
                from: toCalendarDate(range.from),
                to: toCalendarDate(range.to),
              })
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** "Oct 1 – Oct 31, 2026"; the year shows once when both ends share it. */
function formatRange({ from, to }: CalendarDateRange): string {
  if (from === to) return formatCalendarDate(from) ?? from
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const start = sameYear
    ? formatCalendarDate(from, { month: 'short', day: 'numeric' })
    : formatCalendarDate(from)
  return `${start ?? from} – ${formatCalendarDate(to) ?? to}`
}
