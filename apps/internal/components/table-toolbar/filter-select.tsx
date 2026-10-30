'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@pts/ui/badge'
import { Checkbox } from '@pts/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { cn } from '@/lib/utils'

const ALL = 'all'

type FilterOption = {
  value: string
  label: string
  /**
   * Badge class token: the option (and the selected value) shows as the same
   * badge its table column uses (statuses, forms, billing).
   */
  badgeClassName?: string
}

type SingleProps = {
  mode?: 'single'
  /** Current validated value; undefined = All. */
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** 'All …' placeholder — carries the filter's meaning (D5, no labels). */
  placeholder: string
  options: readonly FilterOption[]
  className?: string
}

type MultiProps = {
  mode: 'multi'
  values: readonly string[]
  onChange: (values: string[]) => void
  placeholder: string
  options: readonly FilterOption[]
  className?: string
}

export type FilterSelectProps = SingleProps | MultiProps

/**
 * The one filter control (PRD 004 §03): `single` = a searchable combobox
 * ('all' sentinel ↔ param removed); `multi` = the faceted
 * popover lifted from the old ProjectStatusFilter (badges-in-trigger,
 * Clear/Select-all footer). One standard trigger width.
 */
export function FilterSelect(props: FilterSelectProps) {
  if (props.mode === 'multi') {
    return <MultiFilterSelect {...props} />
  }
  return <SingleFilterSelect {...props} />
}

function SingleFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: SingleProps) {
  // Every list filter is a searchable combobox, however short its list: it
  // opens on the selected option, and typing narrows it.
  return (
    <SearchableCombobox
      items={[
        { value: ALL, label: placeholder },
        ...options.map(option => ({
          value: option.value,
          label: option.label,
        })),
      ]}
      value={value ?? ALL}
      onChange={next => onChange(next === ALL ? undefined : next)}
      placeholder={placeholder}
      searchPlaceholder='Search…'
      emptyMessage='No matches.'
      ariaLabel={placeholder}
      // The wrapper is full width by default: filters sit in one row.
      className={cn('w-40 shrink-0', className)}
    />
  )
}

function MultiFilterSelect({
  values,
  onChange,
  placeholder,
  options,
  className,
}: MultiProps) {
  const allSelected = values.length === options.length

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(entry => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'h-auto min-h-9 w-full justify-start gap-2 px-3 py-1.5 font-normal sm:w-auto',
            className
          )}
        >
          {values.length === 0 ? (
            <span className='text-muted-foreground'>{placeholder}</span>
          ) : allSelected ? (
            <span className='text-muted-foreground'>{placeholder}: All</span>
          ) : (
            <span className='flex flex-wrap items-center gap-1'>
              {options
                .filter(option => values.includes(option.value))
                .map(option => (
                  <Badge
                    key={option.value}
                    variant='outline'
                    className={cn(option.badgeClassName)}
                  >
                    {option.label}
                  </Badge>
                ))}
            </span>
          )}
          <ChevronDown className='text-muted-foreground ml-auto size-4 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-2'>
        <div className='flex flex-col gap-0.5'>
          {options.map(option => {
            const selected = values.includes(option.value)
            return (
              <label
                key={option.value}
                className='hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm'
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggle(option.value)}
                />
                {option.badgeClassName ? (
                  <Badge
                    variant='outline'
                    className={cn(option.badgeClassName)}
                  >
                    {option.label}
                  </Badge>
                ) : (
                  <span>{option.label}</span>
                )}
              </label>
            )
          })}
        </div>
        <div className='mt-2 flex items-center justify-between border-t pt-2'>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={() => onChange([])}
          >
            Clear
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={() => onChange(options.map(option => option.value))}
          >
            Select all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
