'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronsUpDown, ExternalLink, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import {
  subscribeSheetCreated,
  type SheetCreatedEntity,
  type SheetCreatedRecords,
} from '@/lib/sheets/created'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

export type EntityLinkOption = {
  id: string
  label: string
  /** Second line in the list, e.g. an email. */
  description?: string | null
}

type EntityLinkPickerProps<E extends SheetCreatedEntity> = {
  /** Sheet entity used for "Create new…" and "Open". */
  entity: E
  /** Singular noun for copy: "company" → "Search companies…". */
  entityLabel: string
  value: EntityLinkOption | null
  onChange: (value: EntityLinkOption | null) => void
  options: readonly EntityLinkOption[]
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  /** Turns a record from the create sheet into an option. */
  toOption: (record: SheetCreatedRecords[E]) => EntityLinkOption
  /** Query param that prefills the create sheet's name (`companyName`). */
  createPrefillParam: string
  /** Hide the "Create new…" rows (roles that can't create the entity). */
  allowCreate?: boolean
  id?: string
  'aria-label'?: string
  icon?: ReactNode
}

/**
 * The portal's one pattern for linking a record to another: a combobox that
 * searches existing records, offers "Create new …" (which opens that
 * entity's create sheet on top of the current one and selects the new
 * record when it saves), clears with one click, and opens the linked record.
 * The link itself is saved with the host form, never on selection.
 */
export function EntityLinkPicker<E extends SheetCreatedEntity>({
  entity,
  entityLabel,
  value,
  onChange,
  options,
  isLoading = false,
  disabled = false,
  placeholder,
  toOption,
  createPrefillParam,
  allowCreate = true,
  id,
  'aria-label': ariaLabel,
  icon,
}: EntityLinkPickerProps<E>) {
  const { open: openSheet, openNew } = useSheetParams()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Only the picker that asked for the create sheet takes its record.
  const awaitingCreate = useRef(false)
  const onChangeRef = useRef(onChange)
  const toOptionRef = useRef(toOption)
  useEffect(() => {
    onChangeRef.current = onChange
    toOptionRef.current = toOption
  })

  useEffect(
    () =>
      subscribeSheetCreated(entity, record => {
        if (!awaitingCreate.current) return
        awaitingCreate.current = false
        onChangeRef.current(toOptionRef.current(record))
      }),
    [entity]
  )

  const handleCreate = (typed: string) => {
    awaitingCreate.current = true
    setIsOpen(false)
    setQuery('')
    openNew(entity, typed.trim() ? { [createPrefillParam]: typed.trim() } : undefined)
  }

  const plural = entityLabel.endsWith('y')
    ? `${entityLabel.slice(0, -1)}ies`
    : `${entityLabel}s`

  return (
    <div className='flex items-center gap-1'>
      <Popover
        open={isOpen}
        onOpenChange={next => {
          setIsOpen(next)
          if (!next) setQuery('')
        }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={isOpen}
            aria-label={ariaLabel}
            disabled={disabled}
            className='min-w-0 flex-1 justify-between font-normal'
          >
            <span className='flex min-w-0 items-center gap-2'>
              {icon}
              <span
                className={cn('truncate', !value && 'text-muted-foreground')}
              >
                {value?.label ?? placeholder ?? `Select a ${entityLabel}`}
              </span>
            </span>
            <ChevronsUpDown className='text-muted-foreground size-4 shrink-0' />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-(--anchor-width) min-w-72 p-0'
          align='start'
        >
          <Command>
            <CommandInput
              placeholder={`Search ${plural}…`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading ? (
                <p className='text-muted-foreground px-3 py-2 text-sm'>Loading…</p>
              ) : (
                <CommandGroup>
                  {options.map(option => (
                    <CommandItem
                      key={option.id}
                      value={`${option.label} ${option.description ?? ''} ${option.id}`}
                      onSelect={() => {
                        onChange(option)
                        setIsOpen(false)
                        setQuery('')
                      }}
                    >
                      <div className='flex min-w-0 flex-col'>
                        <span
                          className={cn(
                            'truncate',
                            option.id === value?.id && 'font-semibold'
                          )}
                        >
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className='text-muted-foreground truncate text-xs'>
                            {option.description}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {allowCreate ? (
                <CommandCreateRows
                  query={query}
                  entityLabel={entityLabel}
                  onCreate={handleCreate}
                />
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={`Open ${value.label}`}
                onClick={() => openSheet(entity, value.id)}
              >
                <ExternalLink aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open {entityLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={`Clear ${entityLabel}`}
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                <X aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
        </>
      ) : null}
    </div>
  )
}
