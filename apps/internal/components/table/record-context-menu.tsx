'use client'

import { useRef, useState, type ReactElement } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  CircleCheck,
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
} from '@placetostand/ui/context-menu'

import {
  isDuplicableSheetEntity,
  isSheetEntityKey,
  type SheetEntityKey,
} from '@/lib/sheets/entities'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { toastLink, useToast } from '@/components/ui/use-toast'

import { AssigneeSubmenu, type AssigneeMenuConfig } from './assignee-submenu'
import { DueDateSubmenu, type DueDateMenuConfig } from './due-date-submenu'

/**
 * Send to top / Send to bottom on a board card: the same move as dragging it
 * to that end of its column. Null disables the item (the card is already
 * there).
 */
export type CardEdgeMoves = {
  toTop: (() => void) | null
  toBottom: (() => void) | null
  /** Selected cards moving together; the toast counts them. */
  count: number
}

/** The menu's Send to top / bottom: the moves, and the card's name. */
type EdgeMoveMenuConfig = CardEdgeMoves & {
  /**
   * Named in the toast. The column stays where it is (no scrolling after
   * the card), so the toast says where the card went.
   */
  name: string
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
  /** Replaces the default duplicate (the design system specimen). */
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
  /**
   * Adds "Mark as done" (task board cards): the same move as dragging the
   * card, or the selection it belongs to, to the top of Done. Read when the
   * menu opens; null there disables the item (already done).
   */
  markDone?: () => (() => void) | null
  /** Adds Send to top and Send to bottom (cards on a board). */
  move?: EdgeMoveMenuConfig
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
 * (tasks and leads), Set due date (tasks), Mark as done and Send to top /
 * bottom (board cards), then Archive or Restore. Each action is the same one
 * the row's buttons and the sheet already run, so the menu adds a way in,
 * never a second behaviour.
 */
export function RecordContextMenu({
  children,
  draggable = false,
  disabled = false,
  ...itemProps
}: RecordContextMenuProps) {
  const actionsRef = useRef<MenuActions | null>(null)
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
      <ContextMenuTrigger render={children} />
      {/* The menu is portaled, but React still bubbles its clicks to the
          row, whose own click would open the record too. */}
      <ContextMenuContent onClick={event => event.stopPropagation()}>
        <RecordContextMenuItems
          {...itemProps}
          closeMenu={() => actionsRef.current?.close()}
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
  markDone,
  move,
  onArchive,
  onRestore,
  archiveDisabledReason = null,
  pending = false,
  closeMenu,
}: Omit<RecordContextMenuProps, 'children' | 'draggable' | 'disabled'> & {
  /** Closes the menu from controls that aren't menu items (the calendar). */
  closeMenu: () => void
}) {
  const { open, duplicate } = useSheetParams()
  const { toast } = useToast()
  const sendTo = (run: (() => void) | null, end: 'top' | 'bottom') => () => {
    if (!run || !move) return
    run()
    // A group names how many moved; one card names itself and links to it.
    toast(
      move.count > 1
        ? { title: `Moved ${move.count} ${entity}s to ${end}` }
        : {
            title: `Moved to ${end}`,
            description: move.name,
            ...(isSheetEntityKey(entity)
              ? { link: toastLink(entity, id) }
              : {}),
          }
    )
  }
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
      {markDone ? <MarkDoneItem markDone={markDone} /> : null}
      {move ? (
        <>
          {editable || canDuplicate || assign || dueDate || markDone ? (
            <ContextMenuSeparator />
          ) : null}
          <ContextMenuItem
            disabled={!move.toTop}
            onClick={sendTo(move.toTop, 'top')}
          >
            <ArrowUpToLine />
            Send to top
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!move.toBottom}
            onClick={sendTo(move.toBottom, 'bottom')}
          >
            <ArrowDownToLine />
            Send to bottom
          </ContextMenuItem>
        </>
      ) : null}
      {(editable || canDuplicate || assign || dueDate || markDone || move) &&
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

/**
 * Checked once per opening, so a card already in Done shows it disabled;
 * the move itself is read again on the click, from the board as it is then.
 */
function MarkDoneItem({ markDone }: { markDone: () => (() => void) | null }) {
  const [enabled] = useState(() => markDone() !== null)
  return (
    <ContextMenuItem disabled={!enabled} onClick={() => markDone()?.()}>
      <CircleCheck />
      Mark as done
    </ContextMenuItem>
  )
}
