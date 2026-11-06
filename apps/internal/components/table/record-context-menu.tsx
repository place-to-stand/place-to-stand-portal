'use client'

import type { ReactElement } from 'react'
import { Archive, Copy, Pencil, RefreshCw } from 'lucide-react'

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
  /** Replaces the default duplicate (the /design specimen). */
  onDuplicate?: () => void
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
 * records that can be copied, see `DUPLICABLE_SHEET_ENTITIES`), then Archive
 * or Restore. Each action is the same one the row's buttons and the sheet
 * already run, so the menu adds a way in, never a second behaviour.
 */
export function RecordContextMenu({
  entity,
  id,
  children,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  archiveDisabledReason = null,
  pending = false,
  draggable = false,
  disabled = false,
}: RecordContextMenuProps) {
  const { open, duplicate } = useSheetParams()
  const canDuplicate = isDuplicableSheetEntity(entity)
  const lifecycleDisabled = pending || Boolean(archiveDisabledReason)

  return (
    <ContextMenu
      disabled={disabled}
      onOpenChange={(next, details) => {
        if (next && draggable && details.event?.type.startsWith('touch')) {
          details.cancel()
        }
      }}
    >
      <ContextMenuTrigger render={children} />
      {/* The menu is portaled, but React still bubbles its clicks to the
          row, whose own click would open the record too. */}
      <ContextMenuContent onClick={event => event.stopPropagation()}>
        <ContextMenuItem
          onClick={() => {
            if (onEdit) onEdit()
            else if (isSheetEntityKey(entity)) open(entity, id)
          }}
        >
          <Pencil />
          Edit
        </ContextMenuItem>
        {canDuplicate ? (
          <ContextMenuItem
            onClick={() =>
              onDuplicate ? onDuplicate() : duplicate(entity, id)
            }
          >
            <Copy />
            Duplicate
          </ContextMenuItem>
        ) : null}
        {onArchive || onRestore ? <ContextMenuSeparator /> : null}
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
      </ContextMenuContent>
    </ContextMenu>
  )
}
