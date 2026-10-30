'use client'

import type { ReactNode } from 'react'

import { Button } from '@pts/ui/button'
import { Badge } from '@pts/ui/badge'
import { Checkbox } from '@pts/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { FieldClearButton } from '@/components/ui/field-clear-button'
import {
  FieldTrigger,
  FILTER_TRIGGER_WIDTH,
} from '@/components/ui/field-trigger'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { cn } from '@/lib/utils'

export type FilterOption = {
  value: string
  label: string
  /**
   * When the list shows this value as a badge: the badge's tone classes,
   * from the same mapping the list column uses (`getLeadStatusToken`,
   * `invoiceStatusTint`…). The option, and the trigger once picked, then
   * show that badge. `''` is the plain outline badge (roles).
   */
  badgeClassName?: string
  /** A ready-made badge, for one with more than a tone (`<ClientBadge />`). */
  badge?: ReactNode
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
  /** The selection the list starts from; the × shows away from it. Default: none. */
  defaultValues?: readonly string[]
  /** What the × does; defaults to `onChange(defaultValues)`. */
  onClear?: () => void
  className?: string
}

export type FilterSelectProps = SingleProps | MultiProps

/**
 * The one filter control (PRD 004 §03). Both modes share the field trigger
 * (`FieldTrigger`: one width, the label, a clear × away from the default,
 * the up-down chevron). `single` = the clearable searchable combobox
 * ("All …" when empty); `multi` = the same trigger over a checkbox popover
 * with Clear/Select all. Values the list shows as badges show as the same
 * badges here.
 */
export function FilterSelect(props: FilterSelectProps) {
  if (props.mode === 'multi') {
    return <MultiFilterSelect {...props} />
  }
  return <SingleFilterSelect {...props} />
}

/** The option as the list shows it: its badge, or nothing (plain label). */
function optionBadge(option: FilterOption): ReactNode | undefined {
  if (option.badge) return option.badge
  if (option.badgeClassName === undefined) return undefined
  return (
    <Badge variant='outline' className={cn('shrink-0', option.badgeClassName)}>
      {option.label}
    </Badge>
  )
}

function SingleFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: SingleProps) {
  // Every list filter is a clearable searchable combobox: the placeholder
  // ("All …") when nothing is picked, the choice and an X to clear it back.
  return (
    <SearchableCombobox
      items={options.map(option => ({
        value: option.value,
        label: option.label,
      }))}
      value={value ?? null}
      onChange={next => onChange(next || undefined)}
      onClear={() => onChange(undefined)}
      clearLabel={placeholder}
      placeholder={placeholder}
      searchPlaceholder='Search…'
      emptyMessage='No matches.'
      ariaLabel={placeholder}
      // The wrapper is full width by default: filters sit in one row.
      className={cn(FILTER_TRIGGER_WIDTH, className)}
    />
  )
}

function MultiFilterSelect({
  values,
  onChange,
  placeholder,
  options,
  defaultValues = [],
  onClear,
  className,
}: MultiProps) {
  const allSelected = values.length === options.length
  const isDefault =
    values.length === defaultValues.length &&
    defaultValues.every(value => values.includes(value))
  const selected = options.filter(option => values.includes(option.value))

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(entry => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  const showsPlaceholder = selected.length === 0 || allSelected
  const [first, ...rest] = selected
  const label = showsPlaceholder ? (
    allSelected && selected.length > 0 ? (
      `${placeholder}: All`
    ) : (
      placeholder
    )
  ) : (
    // The first pick as the list shows it, then how many more.
    <span className='flex min-w-0 items-center gap-1'>
      {optionBadge(first) ?? <span className='truncate'>{first.label}</span>}
      {rest.length > 0 ? (
        <span className='text-muted-foreground shrink-0 text-xs font-normal'>
          +{rest.length}
        </span>
      ) : null}
    </span>
  )

  return (
    <div className={cn('relative', FILTER_TRIGGER_WIDTH, className)}>
      <Popover>
        <PopoverTrigger asChild>
          <FieldTrigger
            aria-label={placeholder}
            placeholder={showsPlaceholder}
            clearable={!isDefault}
            labelTitle={
              showsPlaceholder
                ? undefined
                : selected.map(option => option.label).join(', ')
            }
            label={label}
          />
        </PopoverTrigger>
        <PopoverContent className='w-64 p-2' sideOffset={8}>
          <div className='flex flex-col gap-0.5'>
            {options.map(option => (
              <label
                key={option.value}
                className='hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm'
              >
                <Checkbox
                  checked={values.includes(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                />
                {optionBadge(option) ?? <span>{option.label}</span>}
              </label>
            ))}
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
      {isDefault ? null : (
        <FieldClearButton
          label={placeholder.toLowerCase()}
          onClear={() => (onClear ? onClear() : onChange([...defaultValues]))}
        />
      )}
    </div>
  )
}
