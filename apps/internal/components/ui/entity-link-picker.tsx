'use client'

import { useEffect, useMemo, useRef, type ComponentType } from 'react'
import { ExternalLink, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  subscribeSheetCreated,
  type SheetCreatedEntity,
  type SheetCreatedRecords,
} from '@/lib/sheets/created'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

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
  disabled?: boolean
  placeholder?: string
  /** Turns a record from the create sheet into an option. */
  toOption: (record: SheetCreatedRecords[E]) => EntityLinkOption
  /** Query param that prefills the create sheet's name (`companyName`). */
  createPrefillParam: string
  /** Hide "Create new…" (roles that can't create the entity). */
  allowCreate?: boolean
  id?: string
  'aria-label'?: string
  icon?: ComponentType<{ className?: string }>
}

const pluralize = (noun: string) =>
  noun.endsWith('y') ? `${noun.slice(0, -1)}ies` : `${noun}s`

/**
 * The portal's one pattern for linking a record to another, built on
 * `SearchableCombobox`: search existing records, "Create new …" (opens that
 * entity's create sheet on top of the current one and selects the new record
 * when it saves), clear with one click, and open the linked record. The link
 * itself is saved with the host form, never on selection.
 */
export function EntityLinkPicker<E extends SheetCreatedEntity>({
  entity,
  entityLabel,
  value,
  onChange,
  options,
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

  // The selected record stays listed even before the options refetch (a
  // just-created record) or when it's no longer offered (archived).
  const items = useMemo<SearchableComboboxItem[]>(() => {
    const all =
      value && !options.some(option => option.id === value.id)
        ? [value, ...options]
        : options
    return all.map(option => ({
      value: option.id,
      label: option.label,
      description: option.description ?? undefined,
      keywords: option.description ? [option.description] : undefined,
      icon,
    }))
  }, [icon, options, value])

  const plural = pluralize(entityLabel)

  return (
    <div className='flex items-center gap-1'>
      <SearchableCombobox
        id={id}
        className='flex-1'
        items={items}
        value={value?.id ?? ''}
        onChange={nextId => {
          const next = items.find(item => item.value === nextId)
          onChange(
            next
              ? {
                  id: next.value,
                  label: next.label,
                  description: next.description,
                }
              : null
          )
        }}
        placeholder={placeholder ?? `Select a ${entityLabel}`}
        searchPlaceholder={`Search ${plural}…`}
        emptyMessage={`No ${plural} found.`}
        disabled={disabled}
        ariaLabel={ariaLabel}
        createEntityLabel={entityLabel}
        onCreate={
          allowCreate
            ? typed => {
                awaitingCreate.current = true
                openNew(
                  entity,
                  typed.trim()
                    ? { [createPrefillParam]: typed.trim() }
                    : undefined
                )
              }
            : undefined
        }
      />
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
