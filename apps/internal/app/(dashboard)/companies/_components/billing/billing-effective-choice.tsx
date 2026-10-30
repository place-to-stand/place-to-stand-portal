'use client'

import { formatCalendarDate } from '@pts/ui/dates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { BillingEffectiveValue } from '@/lib/companies/sheet-save-schema'

/** "October 2026" for this month (0) or next (1). */
export function monthLabel(offset: 0 | 1): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const month = String(target.getMonth() + 1).padStart(2, '0')
  return (
    formatCalendarDate(`${target.getFullYear()}-${month}-01`, {
      month: 'long',
      year: 'numeric',
    }) ?? ''
  )
}

type BillingEffectiveChoiceProps = {
  id: string
  title: string
  value: BillingEffectiveValue
  onChange: (value: BillingEffectiveValue) => void
  /** The words for each choice, in the order shown. */
  options: { value: BillingEffectiveValue; label: string }[]
  disabled: boolean
  disabledReason: string | null
}

/**
 * When a start, stop or restart of billing takes effect: the same tinted
 * callout and month select as a billing type or commission change
 * (`ClientEffectiveCallout`), bound to the sheet's billing state.
 */
export function BillingEffectiveChoice({
  id,
  title,
  value,
  onChange,
  options,
  disabled,
  disabledReason,
}: BillingEffectiveChoiceProps) {
  return (
    <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3'>
      <label htmlFor={id} className='text-sm font-medium'>
        {title}
      </label>
      <Select
        value={value}
        onValueChange={next => onChange(next as BillingEffectiveValue)}
        disabled={disabled}
      >
        <DisabledFieldTooltip
          disabled={disabled}
          reason={disabledReason}
          className='w-auto'
        >
          <SelectTrigger id={id} className='w-72 max-w-full shrink-0'>
            <SelectValue>
              {options.find(option => option.value === value)?.label}
            </SelectValue>
          </SelectTrigger>
        </DisabledFieldTooltip>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
