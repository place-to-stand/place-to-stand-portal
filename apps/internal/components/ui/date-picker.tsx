'use client'

import * as React from 'react'
import { CalendarIcon, XIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Calendar } from '@pts/ui/calendar'
import { formatCalendarDate } from '@pts/ui/dates'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { fieldTriggerClasses } from '@/components/ui/searchable-combobox'
import {
  parseCalendarDate,
  toCalendarDate,
  WEEK_STARTS_ON,
} from '@/lib/dates/calendar-date'
import { cn } from '@/lib/utils'

type TriggerProps = Omit<
  React.ComponentProps<'button'>,
  'value' | 'onChange' | 'defaultValue' | 'children' | 'type'
>

export type DatePickerProps = TriggerProps & {
  /** `YYYY-MM-DD`; empty/null shows the placeholder. */
  value: string | null | undefined
  /** Fires with `YYYY-MM-DD`, or `''` when cleared. */
  onChange: (value: string) => void
  placeholder?: string
  /** Shows a clear (×) button while a date is set. Default true. */
  clearable?: boolean
  /** Inclusive `YYYY-MM-DD` bounds; days outside are disabled. */
  min?: string
  max?: string
  /** Wrapper classes (width, grid placement). */
  className?: string
  triggerClassName?: string
}

/**
 * Single calendar-date field: the combobox-style trigger opening a calendar
 * popover. Values are `YYYY-MM-DD` strings, the same shape the old
 * `<input type='date'>` produced, so react-hook-form fields swap in directly.
 * `id`/`aria-*` props land on the trigger, so `FormControl` and `<label for>`
 * work unchanged.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  function DatePicker(
    {
      value,
      onChange,
      placeholder = 'Pick a date',
      clearable = true,
      min,
      max,
      disabled,
      className,
      triggerClassName,
      onBlur,
      ...triggerProps
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false)
    const selected = parseCalendarDate(value)
    const label = selected ? formatCalendarDate(value) : null
    const minDate = parseCalendarDate(min)
    const maxDate = parseCalendarDate(max)
    const disabledDays = [
      ...(minDate ? [{ before: minDate }] : []),
      ...(maxDate ? [{ after: maxDate }] : []),
    ]
    const showClear = clearable && Boolean(selected) && !disabled

    return (
      <div className={cn('relative w-full min-w-0', className)}>
        <Popover
          open={open}
          onOpenChange={next => {
            if (disabled) return
            setOpen(next)
          }}
        >
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type='button'
              variant='outline'
              aria-haspopup='dialog'
              aria-expanded={open}
              disabled={disabled}
              data-placeholder={selected ? undefined : true}
              onBlur={onBlur}
              {...triggerProps}
              className={cn(
                fieldTriggerClasses,
                showClear && 'pr-14',
                triggerClassName
              )}
            >
              <span
                className={cn(
                  'min-w-0 truncate',
                  selected ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                {label ?? placeholder}
              </span>
              <CalendarIcon className='size-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className='w-auto p-0'
            sideOffset={8}
            initialFocus={focusCalendarDay}
          >
            <Calendar
              mode='single'
              selected={selected}
              defaultMonth={selected ?? maxDate ?? minDate}
              weekStartsOn={WEEK_STARTS_ON}
              disabled={disabledDays}
              onSelect={date => {
                onChange(date ? toCalendarDate(date) : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        {showClear ? (
          <button
            type='button'
            aria-label='Clear date'
            onClick={() => onChange('')}
            className='text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 absolute top-1/2 right-8 -translate-y-1/2 rounded p-1 outline-none focus-visible:ring-2'
          >
            <XIcon className='size-3.5' aria-hidden />
          </button>
        ) : null}
      </div>
    )
  }
)

/**
 * Opening a calendar popover puts focus on its roving-tabindex day (the
 * selected day, else today) so arrow keys move through days immediately.
 * Shared by `DatePicker` and `DateRangePicker`.
 */
export function focusCalendarDay(): HTMLElement | boolean {
  const day = document.querySelector<HTMLElement>(
    '[data-slot=popover-content] [data-slot=calendar] td button[tabindex="0"]'
  )
  return day ?? true
}
