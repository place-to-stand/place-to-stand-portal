'use client'

import {
  createContext,
  useContext,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { Checkbox } from '@pts/ui/checkbox'
import { TableCell, TableHead } from '@pts/ui/table'
import { cn } from '@/lib/utils'

import {
  BULK_ARCHIVE_ENTITIES,
  type BulkArchiveEntity,
} from '@/lib/bulk/archive-entities'

import type { RowSelection } from './use-row-selection'

type SelectionContextValue = {
  selection: RowSelection
  entity: BulkArchiveEntity
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

/** Gives a table's select column its selection. */
export function RowSelectionProvider({
  selection,
  entity,
  children,
}: SelectionContextValue & { children: ReactNode }) {
  return (
    <SelectionContext.Provider value={{ selection, entity }}>
      {children}
    </SelectionContext.Provider>
  )
}

function useSelectionContext() {
  const value = useContext(SelectionContext)
  if (!value) {
    throw new Error('Select cells need a RowSelectionProvider.')
  }
  return value
}

function useSelection() {
  return useSelectionContext().selection
}

/**
 * The leading column: 8px before the 16px box (the cells' usual left
 * padding), the rest of its 32px after it. One width on every list,
 * so names start at the same place everywhere.
 */
const COLUMN_CLASS = 'w-8 pl-2 pr-0'

/**
 * Boxes stay out of sight until they are useful: a row's box shows while
 * the row is hovered or focused, and once
 * any row is ticked every box shows. Phones have no hover, so the column
 * is hidden there.
 */
const HIDDEN_BOX =
  'opacity-0 transition-opacity focus-visible:opacity-100 [tr:focus-within_&]:opacity-100 [tr:hover_&]:opacity-100'

/**
 * The header box. It ticks the whole page, or with `ids` just that table's
 * rows (a list split into several tables).
 */
export function SelectAllHead({ ids }: { ids?: string[] }) {
  const { selection, entity } = useSelectionContext()
  const label = BULK_ARCHIVE_ENTITIES[entity].plural
  const state = ids ? selection.groupState(ids) : selection.headState
  if ((ids ? ids.length : selection.pageCount) === 0) {
    return <TableHead className={COLUMN_CLASS} aria-hidden />
  }
  return (
    <TableHead
      data-slot='table-select-head'
      className={cn(COLUMN_CLASS, 'align-middle')}
    >
      {/* Wrapped so the table's checkbox nudge (translate-y-0.5) skips it. */}
      <div className='flex items-center'>
        <Checkbox
          aria-label={
            ids
              ? `Select all ${label} in this table`
              : `Select all ${label} on this page`
          }
          checked={state === 'all'}
          indeterminate={state === 'some'}
          onCheckedChange={() =>
            ids ? selection.toggleGroup(ids) : selection.toggleAll()
          }
          className='cursor-pointer'
        />
      </div>
    </TableHead>
  )
}

type SelectRowCellProps = {
  id: string
  /** The row's name, for the box's accessible name ("Select Acme"). */
  label: string
  /**
   * Unread rows show a dot here. It gives way to the box on hover; the row
   * itself carries `UNREAD_ROW_CLASS` so it still reads as unread.
   */
  unread?: boolean
  /** Screen-reader word for the dot ("Unacknowledged"). */
  unreadLabel?: string
}

export function SelectRowCell({
  id,
  label,
  unread = false,
  unreadLabel = 'Unread',
}: SelectRowCellProps) {
  const selection = useSelection()
  const checked = selection.isSelected(id)
  const revealed = selection.active || checked

  // The whole cell is the target, not just the 16px box; a click here never
  // opens the row.
  const handleCellClick = (event: MouseEvent<HTMLTableCellElement>) => {
    event.stopPropagation()
    if ((event.target as Element).closest('[role="checkbox"]')) return
    selection.toggle(id, { range: event.shiftKey })
  }

  return (
    <TableCell
      data-slot='table-select-cell'
      onClick={handleCellClick}
      // Shift-click ticks a range; don't let it select the text between.
      onMouseDown={event => {
        if (event.shiftKey) event.preventDefault()
      }}
      className={cn(
        COLUMN_CLASS,
        'cursor-pointer',
        // Stacked phone cards have no hover and no room: the column goes,
        // and an unread row keeps its tint.
        'max-md:hidden'
      )}
    >
      <span className='relative block size-4'>
        {unread ? (
          <>
            <span
              aria-hidden
              className={cn(
                'bg-primary absolute inset-1 rounded-full transition-opacity',
                revealed
                  ? 'md:opacity-0'
                  : 'md:[tr:focus-within_&]:opacity-0 md:[tr:hover_&]:opacity-0'
              )}
            />
            <span className='sr-only'>{unreadLabel}</span>
          </>
        ) : null}
        <Checkbox
          aria-label={`Select ${label}`}
          checked={checked}
          onCheckedChange={(_, details) => {
            const event = details.event as Partial<globalThis.MouseEvent>
            selection.toggle(id, { range: Boolean(event?.shiftKey) })
          }}
          className={cn(
            'absolute inset-0 cursor-pointer',
            !revealed && HIDDEN_BOX
          )}
        />
      </span>
    </TableCell>
  )
}

/**
 * For a row component rendered inside the provider: spread on its
 * `TableRow` so a ticked row takes the shared selected tint.
 */
export function useSelectedRowProps(id: string) {
  const selection = useSelection()
  return { 'data-selected': selection.isSelected(id) || undefined }
}
