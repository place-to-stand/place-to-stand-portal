'use client'

import { startTransition, useOptimistic, type ReactNode } from 'react'

import { Button } from '@placetostand/ui/button'
import { Badge } from '@placetostand/ui/badge'
import { Checkbox } from '@placetostand/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@placetostand/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FieldClearButton } from '@/components/ui/field-clear-button'
import {
  FieldTrigger,
  FILTER_TRIGGER_WIDTH,
} from '@/components/ui/field-trigger'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { cn } from '@/lib/utils'

type FilterOption = {
  value: string
  label: string
  /**
   * When the list shows this value as a badge: the badge's tone classes,
   * from the same mapping the list column uses (`getLeadStatusToken`,
   * `invoiceStatusTint`…). The option, and the trigger once picked, then
   * show that badge. `''` is the plain outline badge (roles).
   */
  badgeClassName?: string
  /** A ready-made badge, for one with more than a tone. */
  badge?: ReactNode
}

type SingleProps = {
  mode?: 'single'
  /** Current validated value; undefined = All. */
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** 'All …' placeholder — carries the filter's meaning (filters have no labels). */
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
  /**
   * What the field says with every option picked, when that means no filter
   * ("All statuses"). Without it the field lists the picks, as with any
   * other selection: picking every tag still leaves out untagged records.
   */
  allLabel?: string
  /**
   * What the field says with nothing picked, when nothing picked filters out
   * everything ("No statuses"). Without it, nothing picked means no filter
   * and the field shows the placeholder.
   */
  emptyLabel?: string
  className?: string
}

type FilterSelectProps = SingleProps | MultiProps

/**
 * A multi filter with more options than this gets a search field (tags);
 * a short list (statuses) stays a plain checklist.
 */
const MULTI_FILTER_SEARCH_AFTER = 7

/**
 * The one filter control. Both modes share the field trigger
 * (`FieldTrigger`: one width, the label, a clear × away from the default,
 * the up-down chevron). `single` = the clearable searchable combobox
 * ("All …" when empty); `multi` = the same trigger over a checkbox list
 * with Clear/Select all, searchable once it is longer than
 * `MULTI_FILTER_SEARCH_AFTER` options. Arrow keys move and Enter toggles. Values the list shows as badges show as the same
 * badges here.
 */
export function FilterSelect(props: FilterSelectProps) {
  if (props.mode === 'multi') {
    return <MultiFilterSelect {...props} />
  }
  return <SingleFilterSelect {...props} />
}

/**
 * Filters are optimistic: a pick shows at once, and the list catches up
 * behind it. The pick holds while its navigation is pending, then the
 * control shows what the page actually applied (the prop), so it can never
 * show a filter the list doesn't use.
 */
function useOptimisticValue<T>(value: T) {
  const [shown, setShown] = useOptimistic(value)
  const set = (next: T, commit: () => void) =>
    startTransition(() => {
      setShown(next)
      commit()
    })
  return [shown, set] as const
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
  value: propValue,
  onChange: commit,
  placeholder,
  options,
  className,
}: SingleProps) {
  const [value, setValue] = useOptimisticValue(propValue)
  const onChange = (next: string | undefined) =>
    setValue(next, () => commit(next))
  // A single filter is a clearable searchable combobox: the placeholder
  // ("All …") when nothing is picked, the choice and an X to clear it back.
  return (
    <SearchableCombobox
      items={options.map(option => ({
        value: option.value,
        label: option.label,
        render: optionBadge(option),
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
  values: propValues,
  onChange: commit,
  placeholder,
  options,
  defaultValues = [],
  onClear,
  allLabel,
  emptyLabel,
  className,
}: MultiProps) {
  const [values, setValues] = useOptimisticValue(propValues)
  const onChange = (next: string[]) => setValues(next, () => commit(next))
  const allSelected =
    Boolean(allLabel) && options.length > 0 && values.length === options.length
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

  const showsPlaceholder = (selected.length === 0 && !emptyLabel) || allSelected
  const [first, ...rest] = selected
  const label = showsPlaceholder ? (
    allSelected && selected.length > 0 ? (
      allLabel
    ) : (
      placeholder
    )
  ) : selected.length === 0 ? (
    emptyLabel
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
        <PopoverContent className='w-64 p-0' sideOffset={8}>
          {/* The single filter's list (cmdk): same search, keys and rows. */}
          <Command>
            {options.length > MULTI_FILTER_SEARCH_AFTER ? (
              <CommandInput placeholder='Search…' className='h-9' />
            ) : null}
            <CommandList className='max-h-[min(60vh,288px)] overflow-y-auto overscroll-contain p-1'>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup className='p-0'>
                {options.map(option => {
                  const checked = values.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      // What search matches; the value keeps it unique.
                      value={`${option.label} ${option.value}`}
                      onSelect={() => toggle(option.value)}
                      aria-checked={checked}
                      className='gap-2'
                    >
                      {/* Shows the state; the row is the control. */}
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden
                        className='pointer-events-none'
                      />
                      {optionBadge(option) ?? <span>{option.label}</span>}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className='flex items-center justify-between border-t p-2'>
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
          onClear={() =>
            // A custom clear says nothing about what it shows, so it waits
            // for the page; the default clear shows the defaults at once.
            onClear ? onClear() : onChange([...defaultValues])
          }
        />
      )}
    </div>
  )
}
