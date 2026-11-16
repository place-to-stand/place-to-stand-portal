'use client'

import { useRef, type ReactElement } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Pencil,
  RefreshCw,
} from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@pts/ui/context-menu'

import {
  isDuplicableSheetEntity,
  isSheetEntityKey,
  type SheetEntityKey,
} from '@/lib/sheets/entities'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { AssigneeSubmenu, type AssigneeMenuConfig } from './assignee-submenu'
import { DueDateSubmenu, type DueDateMenuConfig } from './due-date-submenu'

/**
 * Send to top / Send to bottom on a board card: the same move as dragging it
 * to that end of its column. Null disables the item (the card is already
 * there).
 */
export type TaskEdgeMoves = {
  toTop: (() => void) | null
  toBottom: (() => void) | null
}

type MenuActions = { close: () => void; unmount: () => void }

type RecordContextMenuProps = {
  /**
   * The record's sheet: Edit opens it, Duplicate opens its copy. Time logs
   * edit in a dialog, so they pass `onEdit`.
   */
  entity: SheetEntityKey | 'time-log'
  id: string
  /**
   * The row or card that answers a right click. It renders as itself (no
   * wrapper element), so a table row stays a direct child of its body.
   */
  children: ReactElement<Record<string, unknown>>
  /**
   * Opens the record. Defaults to its sheet (`?<entity>=<id>`); pass the
   * list's own row handler where the page renders the sheet itself.
   */
  onEdit?: () => void
  /** False hides Edit (rows the list itself doesn't open, e.g. archived logs). */
  editable?: boolean
  /** False hides Duplicate (a viewer who can't create the record). */
  duplicable?: boolean
  /** Replaces the default duplicate (the /design specimen). */
  onDuplicate?: () => void
  /**
   * Adds "Set assignee ›" (tasks and leads): a submenu of the people who can
   * take the record, then "Clear assignee". Omit for viewers who can't edit.
   */
  assign?: AssigneeMenuConfig
  /**
   * Adds "Set due date ›" (tasks): quick days, a calendar and "Clear due
   * date". Omit for viewers who can't edit.
   */
  dueDate?: DueDateMenuConfig
  /** Adds Send to top and Send to bottom (cards on a board). */
  move?: TaskEdgeMoves
  /** The list's archive handler (its confirm dialog). Omit when archived. */
  onArchive?: () => void
  /** The archive list's restore handler. */
  onRestore?: () => void
  /** Why archive/restore can't run now; the item shows it, disabled. */
  archiveDisabledReason?: string | null
  /** True while this row's action runs. */
  pending?: boolean
  /**
   * Cards that drag on touch: a held finger starts the drag, so the menu
   * opens on a right click only.
   */
  draggable?: boolean
  /** No menu (e.g. a viewer who can't manage the record). */
  disabled?: boolean
}

/**
 * The right-click menu on every record row and card: Edit, Duplicate (for
 * records that can be copied, see `DUPLICABLE_SHEET_ENTITIES`), Set assignee
 * (tasks and leads), Set due date (tasks), Send to top / bottom (board
 * cards), then Archive or Restore. Each action is the same one the row's buttons and the sheet
 * already run, so the menu adds a way in, never a second behaviour.
 */
export function RecordContextMenu({
  children,
  draggable = false,
  disabled = false,
  ...itemProps
}: RecordContextMenuProps) {
  const actionsRef = useRef<MenuActions | null>(null)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  // Send to top / bottom moves the card to the end of its column. Handing
  // focus back the default way would scroll the column to follow it, so
  // focus returns without scrolling and the column stays where it was.
  const movedRef = useRef(false)
  return (
    <ContextMenu
      actionsRef={actionsRef}
      disabled={disabled}
      onOpenChange={(next, details) => {
        if (next && draggable && isTouchOpen(details.event)) {
          details.cancel()
        }
      }}
    >
      <ContextMenuTrigger ref={triggerRef} render={children} />
      {/* The menu is portaled, but React still bubbles its clicks to the
          row, whose own click would open the record too. */}
      <ContextMenuContent
        onClick={event => event.stopPropagation()}
        finalFocus={() => {
          if (!movedRef.current) return true
          movedRef.current = false
          triggerRef.current?.focus({ preventScroll: true })
          return false
        }}
      >
        <RecordContextMenuItems
          {...itemProps}
          closeMenu={() => actionsRef.current?.close()}
          onMoved={() => {
            movedRef.current = true
          }}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * A press-and-hold rather than a right click: the touch timer, or the
 * contextmenu event Android fires on a long press (a touch PointerEvent).
 */
function isTouchOpen(event: Event | undefined) {
  if (!event) return false
  if (event.type.startsWith('touch')) return true
  if ('pointerType' in event && event.pointerType === 'touch') return true
  const capabilities = (
    event as Event & { sourceCapabilities?: { firesTouchEvents?: boolean } }
  ).sourceCapabilities
  return capabilities?.firesTouchEvents === true
}

/**
 * The items, mounted only while the menu is open, so a row or card doesn't
 * re-render every time the URL changes.
 */
function RecordContextMenuItems({
  entity,
  id,
  onEdit,
  editable = true,
  duplicable = true,
  onDuplicate,
  assign,
  dueDate,
  move,
  onArchive,
  onRestore,
  archiveDisabledReason = null,
  pending = false,
  closeMenu,
  onMoved,
}: Omit<RecordContextMenuProps, 'children' | 'draggable' | 'disabled'> & {
  /** Closes the menu from controls that aren't menu items (the calendar). */
  closeMenu: () => void
  /** Send to top / bottom ran: the menu returns focus without scrolling. */
  onMoved: () => void
}) {
  const { open, duplicate } = useSheetParams()
  const canDuplicate = duplicable && isDuplicableSheetEntity(entity)
  const lifecycleDisabled = pending || Boolean(archiveDisabledReason)

  return (
    <>
      {editable ? (
        <ContextMenuItem
          onClick={() => {
            if (onEdit) onEdit()
            else if (isSheetEntityKey(entity)) open(entity, id)
          }}
        >
          <Pencil />
          Edit
        </ContextMenuItem>
      ) : null}
      {canDuplicate ? (
        <ContextMenuItem
          onClick={() => (onDuplicate ? onDuplicate() : duplicate(entity, id))}
        >
          <Copy />
          Duplicate
        </ContextMenuItem>
      ) : null}
      {assign && isSheetEntityKey(entity) ? (
        <AssigneeSubmenu entity={entity} id={id} {...assign} />
      ) : null}
      {dueDate && isSheetEntityKey(entity) ? (
        <DueDateSubmenu
          entity={entity}
          id={id}
          {...dueDate}
          onPicked={closeMenu}
        />
      ) : null}
      {move ? (
        <>
          {editable || canDuplicate || assign || dueDate ? (
            <ContextMenuSeparator />
          ) : null}
          <ContextMenuItem
            disabled={!move.toTop}
            onClick={() => {
              onMoved()
              move.toTop?.()
            }}
          >
            <ArrowUpToLine />
            Send to top
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!move.toBottom}
            onClick={() => {
              onMoved()
              move.toBottom?.()
            }}
          >
            <ArrowDownToLine />
            Send to bottom
          </ContextMenuItem>
        </>
      ) : null}
      {(editable || canDuplicate || assign || dueDate || move) &&
      (onArchive || onRestore) ? (
        <ContextMenuSeparator />
      ) : null}
      {onArchive ? (
        <ContextMenuItem
          variant='destructive'
          disabled={lifecycleDisabled}
          onClick={onArchive}
        >
          <Archive />
          Archive
        </ContextMenuItem>
      ) : null}
      {onRestore ? (
        <ContextMenuItem disabled={lifecycleDisabled} onClick={onRestore}>
          <RefreshCw />
          Restore
        </ContextMenuItem>
      ) : null}
      {archiveDisabledReason ? (
        <p className='text-muted-foreground max-w-64 px-1.5 py-1 text-xs'>
          {archiveDisabledReason}
        </p>
      ) : null}
    </>
  )
}
