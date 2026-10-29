'use client'

import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { cn } from '@/lib/utils'
import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import {
  FIELD_CLEAR_LABEL_SPACE,
  FieldClearButton,
} from '@/components/ui/field-clear-button'

export type SearchableComboboxItem = {
  value: string
  label: string
  description?: string
  keywords?: string[]
  disabled?: boolean
  avatarUrl?: string | null
  userId?: string
  icon?: React.ComponentType<{ className?: string }>
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
}

/** The field-style trigger every picker shares (combobox, date pickers). */
export const fieldTriggerClasses =
  'border-input data-[placeholder=true]:text-muted-foreground [&_svg]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

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
      const searchValue = [item.label, ...(item.keywords ?? [])]
        .join(' ')
        .trim()
      return (
        <CommandItem
          key={key}
          value={searchValue.length > 0 ? searchValue : item.value}
          onSelect={() => handleSelect(item.value)}
          disabled={item.disabled}
          className='pr-3'
        >
          {/* The check column only exists while something is selected: an
              "Add …" picker (no value) shouldn't indent every option. */}
          {selectedItem ? (
            <CheckIcon
              className={cn(
                'mr-2 size-4 shrink-0',
                selectedItem.value === item.value ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : null}
          {item.userId ? (
            <Avatar size='xs' className='mr-2 shrink-0'>
              {item.avatarUrl && (
                <AvatarImage src={`/api/storage/user-avatar/${item.userId}`} />
              )}
              <AvatarFallback>
                {item.label.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : item.icon ? (
            <Avatar size='xs' className='mr-2 shrink-0'>
              <AvatarFallback className='bg-muted'>
                <item.icon className='text-muted-foreground h-3 w-3' />
              </AvatarFallback>
            </Avatar>
          ) : null}
          <div className={cn(itemWrapperClasses, itemClassName)}>
            <span className='truncate font-medium whitespace-nowrap'>
              {item.label}
            </span>
            {item.description ? (
              <span className='text-muted-foreground truncate text-xs whitespace-nowrap'>
                {item.description}
              </span>
            ) : null}
          </div>
        </CommandItem>
      )
    }

    const resolvedPlaceholder = placeholder ?? searchPlaceholder

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

    const selectedTextClasses = 'font-medium'
    const placeholderTextClasses = 'text-muted-foreground'

    const showClear = Boolean(onClear && selectedItem && !disabled)

    return (
      <div
        className={cn(
          // A custom trigger (an "Add …" button) keeps its own width.
          trigger
            ? 'inline-flex min-w-0 items-center gap-1'
            : 'flex w-full min-w-0 items-center gap-1',
          className
        )}
      >
        <div className='relative min-w-0 flex-1'>
          <input type='hidden' name={name} value={value ?? ''} />
          <Popover open={open} onOpenChange={handleOpenChange} modal>
            <PopoverTrigger asChild>
              {trigger ?? (
                <Button
                  ref={mergedRef}
                  type='button'
                  variant='outline'
                  role='combobox'
                  aria-expanded={open}
                  aria-haspopup='listbox'
                  aria-label={ariaLabel}
                  aria-labelledby={ariaLabelledBy}
                  aria-describedby={ariaDescribedBy}
                  aria-invalid={ariaInvalid ? true : undefined}
                  disabled={disabled}
                  data-placeholder={selectedItem ? undefined : true}
                  id={id}
                  className={cn(
                    fieldTriggerClasses,
                    // Room for the inline buttons, which sit over the field.
                    triggerClassName
                  )}
                >
                  <div
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2',
                      showClear && FIELD_CLEAR_LABEL_SPACE
                    )}
                  >
                    {selectedItem?.userId ? (
                      <Avatar size='xs'>
                        {selectedItem.avatarUrl && (
                          <AvatarImage
                            src={`/api/storage/user-avatar/${selectedItem.userId}`}
                          />
                        )}
                        <AvatarFallback>
                          {selectedItem.label.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : selectedItem?.icon ? (
                      <Avatar size='xs'>
                        <AvatarFallback className='bg-muted'>
                          <selectedItem.icon className='text-muted-foreground h-3 w-3' />
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <span
                      title={selectedItem?.label}
                      className={cn(
                        'min-w-0 truncate',
                        selectedItem
                          ? selectedTextClasses
                          : placeholderTextClasses
                      )}
                    >
                      {selectedItem?.label ?? resolvedPlaceholder}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className='size-4 shrink-0 opacity-50' />
                </Button>
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
              <Command className='max-h-80'>
                <CommandInput
                  placeholder={searchPlaceholder ?? resolvedPlaceholder}
                  className='h-9'
                  value={query}
                  onValueChange={setQuery}
                />
                {onCreate ? null : <CommandEmpty>{emptyMessage}</CommandEmpty>}
                <CommandList
                  className='max-h-[min(60vh,260px)] [scrollbar-gutter:stable] overflow-y-auto overscroll-contain'
                  onWheel={stopScrollPropagation}
                  onTouchMove={stopScrollPropagation}
                >
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
