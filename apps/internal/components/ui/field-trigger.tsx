'use client'

import * as React from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { FIELD_CLEAR_LABEL_SPACE } from '@/components/ui/field-clear-button'
import { cn } from '@/lib/utils'

/** The field-style trigger every picker shares (combobox, date pickers, filters). */
export const fieldTriggerClasses =
  'border-input data-[placeholder=true]:text-muted-foreground [&_svg:not([data-slot=badge]_svg)]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

type FieldTriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  'children'
> & {
  /** What the field shows: the pick, or the placeholder. */
  label: React.ReactNode
  /** Shows `label` muted, as a placeholder ("All clients"). */
  placeholder?: boolean
  /** Before the label (an avatar). */
  leading?: React.ReactNode
  /** Keeps the label clear of a `FieldClearButton` sitting over the field. */
  clearable?: boolean
  /** Tooltip for a label that may truncate. */
  labelTitle?: string
}

/**
 * The one picker trigger: the outline field, the label (bold when picked,
 * muted as a placeholder), and the up-down chevron. The searchable combobox
 * and every filter popover (multi-choice, date range, My tasks' client
 * scope) render it, so the look is defined once. Pass it as the child of a
 * `PopoverTrigger asChild`; a clear × goes beside it as a `FieldClearButton`
 * inside a `relative` wrapper.
 */
export function FieldTrigger({
  label,
  placeholder = false,
  leading,
  clearable = false,
  labelTitle,
  className,
  ...props
}: FieldTriggerProps) {
  return (
    <Button
      type='button'
      variant='outline'
      data-placeholder={placeholder ? true : undefined}
      {...props}
      className={cn(fieldTriggerClasses, className)}
    >
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2',
          clearable && FIELD_CLEAR_LABEL_SPACE
        )}
      >
        {leading}
        <span
          title={labelTitle}
          className={cn(
            'min-w-0 truncate',
            placeholder ? 'text-muted-foreground' : 'font-medium'
          )}
        >
          {label}
        </span>
      </span>
      <ChevronsUpDownIcon className='size-4 shrink-0 opacity-50' />
    </Button>
  )
}

/** Width of every filter trigger in a FilterBar (stretched in the phone sheet). */
export const FILTER_TRIGGER_WIDTH = 'w-52 shrink-0'
