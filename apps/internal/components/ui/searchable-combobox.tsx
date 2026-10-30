'use client'

import * as React from 'react'
import { CheckIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  useRevealSelected,
} from '@/components/ui/command'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import { FieldClearButton } from '@/components/ui/field-clear-button'
import { FieldTrigger } from '@/components/ui/field-trigger'

export type SearchableComboboxItem = {
  value: string
  label: string
  description?: string
  keywords?: string[]
  disabled?: boolean
  avatarUrl?: string | null
  userId?: string
  icon?: React.ComponentType<{ className?: string }>
  /**
   * Shown in place of the label, in the list row and in the trigger when
   * picked (a status badge). Search still matches `label`.
   */
  render?: React.ReactNode
}

export type SearchableComboboxGroup = {
  label: string
  items: SearchableComboboxItem[]
}

type SearchableComboboxProps = {
  items?: SearchableComboboxItem[]
  groups?: SearchableComboboxGroup[]
  value?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  /** Extra classes for each option's label wrapper (e.g. whitespace-nowrap). */
  itemClassName?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaInvalid?: boolean
  /**
   * Custom trigger element (e.g. an avatar button) rendered in place of the
   * default full-width combobox button. The caller owns its labeling and
   * disabled state; the popover behaves identically either way.
   */
  trigger?: React.ReactElement
  /** Controlled open state (e.g. an empty state that opens the picker). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Adds the pinned "Create …" row (`CommandCreateRows`); fires with the typed
   * search text. Pair with `createEntityLabel` ("company").
   */
  onCreate?: (query: string) => void
  createEntityLabel?: string
  /**
   * Shows a clear (×) button inside the field while a value is selected.
   * Fires instead of opening the list.
   */
  onClear?: () => void
  /**
   * What the clear button empties, for its tooltip: "assignee" → "Clear
   * assignee". Defaults to `ariaLabel`. Set one of them with `onClear`.
   */
  clearLabel?: string
  /**
   * A button beside the field, outside it (e.g. "open this record"). The
   * field shrinks to make room; the clear button stays inside the field.
   */
  trailingAction?: React.ReactNode
  /**
   * Rows above the options inside the list (e.g. My tasks' "Show" toggles),
   * as cmdk `CommandGroup`s so they share the list's keyboard navigation.
   */
  listHeader?: React.ReactNode
}

const itemWrapperClasses = 'flex min-w-0 flex-1 flex-col text-sm leading-tight'

export const SearchableCombobox = React.forwardRef<
  HTMLButtonElement,
  SearchableComboboxProps
>(
  (
    {
      items = [],
      groups,
      value,
      onChange,
      onBlur,
      name,
      id,
      placeholder,
      searchPlaceholder = 'Search...',
      emptyMessage = 'No results found.',
      disabled,
      className,
      triggerClassName,
      itemClassName,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaInvalid,
      trigger,
      onCreate,
      createEntityLabel = 'record',
      onClear,
      clearLabel,
      open: openProp,
      onOpenChange,
      trailingAction,
      listHeader,
    },
    forwardedRef
  ) => {
    const [openState, setOpenState] = React.useState(false)
    const open = openProp ?? openState
    const setOpen = React.useCallback(
      (next: boolean) => {
        setOpenState(next)
        onOpenChange?.(next)
      },
      [onOpenChange]
    )
    const [query, setQuery] = React.useState('')
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const [contentWidth, setContentWidth] = React.useState<number>()
    // Natural width of the popup measured once per open, while every option
    // is still rendered. Freezing it stops the popup from reflowing as
    // filtering hides the widest options.
    const [lockedWidth, setLockedWidth] = React.useState<number>()
    const contentRef = React.useCallback((node: HTMLDivElement | null) => {
      if (!node) {
        setLockedWidth(undefined)
        return
      }
      // The list fills in after mount; measure once it has.
      requestAnimationFrame(() =>
        setLockedWidth(Math.ceil(parseFloat(getComputedStyle(node).width)))
      )
    }, [])

    const mergedRef = React.useMemo(() => {
      if (!forwardedRef) {
        return (node: HTMLButtonElement | null) => {
          triggerRef.current = node
        }
      }

      if (typeof forwardedRef === 'function') {
        return (node: HTMLButtonElement | null) => {
          triggerRef.current = node
          forwardedRef(node)
        }
      }

      return (node: HTMLButtonElement | null) => {
        triggerRef.current = node
        forwardedRef.current = node
      }
    }, [forwardedRef])

    const resolvedGroups = React.useMemo(
      () => groups?.filter(group => group.items.length > 0) ?? [],
      [groups]
    )

    const flattenedItems = React.useMemo(() => {
      if (resolvedGroups.length > 0) {
        return resolvedGroups.flatMap(group => group.items)
      }

      return items
    }, [items, resolvedGroups])

    const selectedItem = React.useMemo(
      () => flattenedItems.find(item => item.value === (value ?? '')) ?? null,
      [flattenedItems, value]
    )

    React.useEffect(() => {
      if (!open) {
        return
      }

      if (triggerRef.current) {
        setContentWidth(triggerRef.current.offsetWidth)
      }
    }, [open])

    const handleOpenChange = (next: boolean) => {
      if (disabled) {
        setOpen(false)
        return
      }

      setOpen(next)
      if (!next) setQuery('')

      if (!next && onBlur) {
        onBlur()
      }
    }

    const handleSelect = (nextValue: string) => {
      if (disabled) {
        return
      }

      onChange(nextValue)
      setOpen(false)
      // The next open starts a fresh search (an "add" picker opens again).
      setQuery('')

      if (onBlur) {
        onBlur()
      }
    }

    const renderItem = (item: SearchableComboboxItem, key: string) => {
      return (
        <CommandItem
          key={key}
          value={commandValueOf(item)}
          onSelect={() => handleSelect(item.value)}
          disabled={item.disabled}
          className='pr-3'
        >
          {renderLeading(item, 'row')}
          <div className={cn(itemWrapperClasses, itemClassName)}>
            {item.render ? (
              <span className='flex min-w-0'>{item.render}</span>
            ) : (
              <span className='truncate font-medium whitespace-nowrap'>
                {item.label}
              </span>
            )}
            {item.description ? (
              <span className='text-muted-foreground truncate text-xs whitespace-nowrap'>
                {item.description}
              </span>
            ) : null}
          </div>
          {/* The selected option is marked on the right, so no row reserves
              an empty column for it. */}
          {selectedItem?.value === item.value ? (
            <CheckIcon className='ml-2 size-4 shrink-0' />
          ) : null}
        </CommandItem>
      )
    }

    const resolvedPlaceholder = placeholder ?? searchPlaceholder

    // Opening shows the selected option in view and highlighted; typing a
    // search goes back to highlighting the top match.
    const selectedCommandValue = selectedItem
      ? commandValueOf(selectedItem)
      : undefined
    const revealSelected = useRevealSelected(selectedCommandValue)

    const stopScrollPropagation = React.useCallback(
      (event: React.SyntheticEvent) => {
        event.stopPropagation()
      },
      []
    )

    const contentStyle = React.useMemo<React.CSSProperties>(() => {
      const maxHeight = 'min(320px, var(--available-height))'
      return {
        maxHeight,
        // The list scrolls itself; a second scrollbar here would eat into
        // the width measured for the options.
        overflowY: 'hidden',
        overscrollBehavior: 'contain',
        // Min-width (not width): the popover never shrinks below the
        // trigger but grows to fit no-wrap options (My Tasks person list).
        ...(contentWidth ? { minWidth: contentWidth } : {}),
        ...(lockedWidth ? { width: lockedWidth } : {}),
      }
    }, [contentWidth, lockedWidth])

    const showClear = Boolean(onClear && selectedItem && !disabled)

    return (
      <div
        className={cn(
          // A custom trigger (an "Add …" button) keeps its own width.
          trigger
            ? 'inline-flex min-w-0 items-center gap-1'
            : // Field to its Open/Create buttons: half the form grid's column gap.
              'flex w-full min-w-0 items-center gap-2',
          className
        )}
      >
        <div className='relative min-w-0 flex-1'>
          <input type='hidden' name={name} value={value ?? ''} />
          <Popover open={open} onOpenChange={handleOpenChange} modal>
            <PopoverTrigger asChild>
              {trigger ?? (
                <FieldTrigger
                  ref={mergedRef}
                  role='combobox'
                  aria-expanded={open}
                  aria-haspopup='listbox'
                  aria-label={ariaLabel}
                  aria-labelledby={ariaLabelledBy}
                  aria-describedby={ariaDescribedBy}
                  aria-invalid={ariaInvalid ? true : undefined}
                  disabled={disabled}
                  id={id}
                  placeholder={!selectedItem}
                  clearable={showClear}
                  className={triggerClassName}
                  labelTitle={selectedItem?.label ?? resolvedPlaceholder}
                  leading={
                    selectedItem ? renderLeading(selectedItem, 'trigger') : null
                  }
                  label={
                    selectedItem
                      ? (selectedItem.render ?? selectedItem.label)
                      : resolvedPlaceholder
                  }
                />
              )}
            </PopoverTrigger>
            <PopoverContent
              ref={contentRef}
              // Never narrower than the trigger; grows to fit an option on one line,
              // up to a cap, past which options truncate with a tooltip.
              className='w-max max-w-[min(28rem,90vw)] overflow-hidden p-0'
              sideOffset={8}
              style={contentStyle}
            >
              <Command className='max-h-80' defaultValue={selectedCommandValue}>
                <CommandInput
                  placeholder={searchPlaceholder ?? resolvedPlaceholder}
                  className='h-9'
                  value={query}
                  onValueChange={setQuery}
                />
                {onCreate ? null : <CommandEmpty>{emptyMessage}</CommandEmpty>}
                <CommandList
                  ref={revealSelected}
                  className='max-h-[min(60vh,260px)] [scrollbar-gutter:stable] overflow-y-auto overscroll-contain'
                  onWheel={stopScrollPropagation}
                  onTouchMove={stopScrollPropagation}
                >
                  {listHeader}
                  {resolvedGroups.length > 0 ? (
                    resolvedGroups.map(group => (
                      <CommandGroup key={group.label} heading={group.label}>
                        {group.items.map(item =>
                          renderItem(item, `${group.label}-${item.value}`)
                        )}
                      </CommandGroup>
                    ))
                  ) : (
                    <CommandGroup>
                      {flattenedItems.map(item => renderItem(item, item.value))}
                    </CommandGroup>
                  )}
                  {onCreate ? (
                    <CommandCreateRows
                      query={query}
                      entityLabel={createEntityLabel}
                      emptyMessage={emptyMessage}
                      onCreate={typed => {
                        setOpen(false)
                        setQuery('')
                        onCreate(typed)
                      }}
                    />
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {showClear ? (
            <FieldClearButton
              label={(clearLabel ?? ariaLabel)?.toLowerCase()}
              onClear={() => {
                onClear?.()
                onBlur?.()
              }}
            />
          ) : null}
        </div>
        {trailingAction}
      </div>
    )
  }
)

SearchableCombobox.displayName = 'SearchableCombobox'

/** The cmdk value of an option: what search matches (label + keywords). */
function commandValueOf(item: SearchableComboboxItem): string {
  const searchValue = [item.label, ...(item.keywords ?? [])].join(' ').trim()
  return searchValue.length > 0 ? searchValue : item.value
}

/** An option's avatar or icon, in its list row or in the trigger. */
function renderLeading(
  item: SearchableComboboxItem,
  place: 'row' | 'trigger'
): React.ReactNode {
  const className = place === 'row' ? 'mr-2 shrink-0' : 'shrink-0'
  if (item.userId) {
    return (
      <Avatar size='xs' className={className}>
        {item.avatarUrl && (
          <AvatarImage src={`/api/storage/user-avatar/${item.userId}`} />
        )}
        <AvatarFallback>{item.label.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    )
  }
  if (item.icon) {
    return (
      <Avatar size='xs' className={className}>
        <AvatarFallback className='bg-muted'>
          <item.icon className='text-muted-foreground h-3 w-3' />
        </AvatarFallback>
      </Avatar>
    )
  }
  return null
}
