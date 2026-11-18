'use client'

import { useMemo } from 'react'
import type { Control } from 'react-hook-form'

import { Checkbox } from '@pts/ui/checkbox'
import { formatCalendarDate } from '@pts/ui/dates'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

import type { TextInput, TextOutput } from './business-form-fields'

/**
 * The partner profit share on the monthly close: from which month, the cash
 * the business keeps before splitting, and who splits it. It stays off until
 * a start month and at least one partner are set.
 */
export function ProfitShareFields({
  control,
  staff,
  disabled,
}: {
  control: Control<TextInput, unknown, TextOutput>
  staff: { id: string; name: string }[]
  disabled: boolean
}) {
  return (
    <section className='grid gap-4'>
      <div className='grid gap-1'>
        <h2 className='text-lg font-semibold'>Profit share</h2>
        <p className='text-muted-foreground text-sm'>
          The monthly close splits the month-end bank balance, less partner
          payouts and the minimum, between the people picked below. Off until
          you pick a start month and at least one person.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='profitShareStartMonth'
          render={({ field }) => (
            <StartMonthField
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
            />
          )}
        />
        <FormField
          control={control}
          name='profitShareMinimumBalance'
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>Minimum balance</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode='decimal'
                  placeholder='0'
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription>
                In dollars. Kept before splitting.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='profitSharePartnerIds'
          render={({ field }) => (
            <FormItem className='sm:col-span-2'>
              <FormLabel optional>Split between</FormLabel>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {staff.map(person => {
                  const id = `profit-share-partner-${person.id}`
                  const checked = field.value.includes(person.id)
                  return (
                    <div key={person.id} className='flex items-center gap-2'>
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={next =>
                          field.onChange(
                            next
                              ? [...field.value, person.id]
                              : field.value.filter(value => value !== person.id)
                          )
                        }
                      />
                      <Label htmlFor={id}>{person.name}</Label>
                    </div>
                  )
                })}
              </div>
              <FormDescription>
                Each person gets an equal share.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  )
}

function StartMonthField({
  value,
  onChange,
  onBlur,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  disabled: boolean
}) {
  const months = useMemo(() => monthOptions(value), [value])
  return (
    <FormItem>
      <FormLabel optional>Start month</FormLabel>
      <FormControl>
        <SearchableCombobox
          items={months}
          value={value || null}
          onChange={onChange}
          onBlur={onBlur}
          onClear={() => onChange('')}
          placeholder='Off'
          searchPlaceholder='Search months...'
          disabled={disabled}
          ariaLabel='Start month'
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

/** Every month from three years back to the end of next year, newest first. */
function monthOptions(current: string): SearchableComboboxItem[] {
  const thisYear = new Date().getFullYear()
  const keys = new Set<string>()
  for (let year = thisYear + 1; year >= thisYear - 3; year--) {
    for (let month = 12; month >= 1; month--) {
      keys.add(`${year}-${String(month).padStart(2, '0')}`)
    }
  }
  if (current) keys.add(current)
  return [...keys]
    .sort()
    .reverse()
    .map(key => ({
      value: key,
      label:
        formatCalendarDate(`${key}-01`, { month: 'long', year: 'numeric' }) ??
        key,
    }))
}
