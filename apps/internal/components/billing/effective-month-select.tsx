'use client'

import type { ReactNode } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

export type EffectiveMonthOption<T extends string> = {
  value: T
  label: string
  /** Why this month can't be picked, else null or absent. */
  disabledReason?: string | null
}

type EffectiveMonthSelectProps<T extends string> = {
  id?: string
  title: string
  value: T
  onChange: (value: T) => void
  /** The months to choose from, in the order shown. */
  options: EffectiveMonthOption<T>[]
  /** One line under the select: what the chosen month means. */
  note?: ReactNode
  disabled?: boolean
  disabledReason?: string | null
}

/**
 * "When does this change take effect": a tinted callout with the title on
 * the left and a month select on the right, plus an optional one-line note.
 * The one shape for billing starts/stops, billing type and commission
 * changes, and a sign-in's role change. Dumb: the caller owns the value.
 */
export function EffectiveMonthSelect<T extends string>({
  id,
  title,
  value,
  onChange,
  options,
  note,
  disabled = false,
  disabledReason = null,
}: EffectiveMonthSelectProps<T>) {
  return (
    <div className='bg-muted/40 grid gap-2 rounded-md border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <label htmlFor={id} className='text-sm font-medium'>
          {title}
        </label>
        <Select
          value={value}
          onValueChange={next => onChange(next as T)}
          disabled={disabled}
        >
          <DisabledFieldTooltip
            disabled={disabled}
            reason={disabledReason}
            className='w-auto'
          >
            <SelectTrigger
              id={id}
              aria-label={id ? undefined : title}
              className='w-72 max-w-full shrink-0'
            >
              <SelectValue>
                {options.find(option => option.value === value)?.label}
              </SelectValue>
            </SelectTrigger>
          </DisabledFieldTooltip>
          <SelectContent>
            {options.map(option => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={Boolean(option.disabledReason)}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {note ? <p className='text-muted-foreground text-xs'>{note}</p> : null}
    </div>
  )
}
