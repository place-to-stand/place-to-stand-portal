'use client'

import { Button } from '@pts/ui/button'

import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { ExternalLink, Plus } from 'lucide-react'

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
  /** A person's avatar (photo, else initials); see `SearchableComboboxItem`. */
  avatar?: SearchableComboboxItem['avatar']
}

type EntityLinkPickerProps<E extends SheetCreatedEntity> = {
  /** Sheet entity used for "Create" and "Open". */
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
  /** More aux params for the create sheet (e.g. `clientCompanyId`). */
  createParams?: Record<string, string>
  /** Hide "Create" (roles that can't create the entity). */
  allowCreate?: boolean
  id?: string
  'aria-label'?: string
  /**
   * A custom trigger (e.g. a section's "Add person" button) in place of the
   * field. Use with `value={null}` to add records to a list one at a time.
   */
  trigger?: ReactElement
  /**
   * A "Create" button beside the field: a shortcut to the create sheet that
   * the list's "Create …" row also opens.
   */
  showCreateButton?: boolean
  /** Controlled open state, e.g. so an empty state can open the picker. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const pluralize = (noun: string) =>
  noun === 'person'
    ? 'people'
    : noun.endsWith('y')
      ? `${noun.slice(0, -1)}ies`
      : `${noun}s`

/**
 * The portal's one pattern for linking a record to another, built on
 * `SearchableCombobox`: search existing records, "Create …" (opens that
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
  createParams,
  allowCreate = true,
  id,
  'aria-label': ariaLabel,
  trigger,
  showCreateButton = false,
  open,
  onOpenChange,
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
      // Options of one entity carry no icon: the field's label shows it.
      avatar: option.avatar,
    }))
  }, [options, value])

  const plural = pluralize(entityLabel)

  const startCreate = (typed: string) => {
    awaitingCreate.current = true
    openNew(entity, {
      ...createParams,
      ...(typed.trim() ? { [createPrefillParam]: typed.trim() } : {}),
    })
  }
  const canCreate = allowCreate && !disabled

  return (
    <SearchableCombobox
      id={id}
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
                avatar: next.avatar,
              }
            : null
        )
      }}
      placeholder={placeholder ?? `Select a ${entityLabel}`}
      searchPlaceholder={`Search ${plural}…`}
      emptyMessage={`No ${plural} found.`}
      disabled={disabled}
      ariaLabel={ariaLabel}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      // A button trigger sizes to itself, not the row.
      className={trigger ? 'w-auto' : undefined}
      createEntityLabel={entityLabel}
      clearLabel={entityLabel}
      onCreate={allowCreate ? startCreate : undefined}
      onClear={() => onChange(null)}
      trailingAction={
        <>
          {value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='text-muted-foreground shrink-0'
                  aria-label={`Open ${value.label}`}
                  onClick={() => openSheet(entity, value.id)}
                >
                  <ExternalLink className='size-3.5' aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open {entityLabel}</TooltipContent>
            </Tooltip>
          ) : null}
          {/* Only while empty: a set value shows Open, and the list's
            Create row still replaces it. */}
          {showCreateButton && allowCreate && !trigger && !value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  className='shrink-0'
                  aria-label={`Create ${entityLabel}`}
                  disabled={!canCreate}
                  onClick={() => startCreate('')}
                >
                  <Plus className='size-3.5' aria-hidden />
                  Create
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create {entityLabel}</TooltipContent>
            </Tooltip>
          ) : null}
        </>
      }
    />
  )
}
