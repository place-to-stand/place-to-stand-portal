'use client'

import { Archive, Copy, MoreHorizontal } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'

export type SheetRecordMenuProps = {
  /** The record's kind in words, for the button's name ("task actions"). */
  noun: string
  /**
   * Open a new create sheet filled in from this record's saved values.
   * Left out for records that can't be copied.
   */
  onDuplicate?: () => void
  /** Left out where the record can't be archived here (an archived one). */
  onRequestArchive?: () => void
  archiveDisabled?: boolean
  /** Why Archive is off, shown under it ("Stop billing first."). */
  archiveDisabledReason?: string | null
}

/**
 * The ⋯ menu in an edit sheet's header: the record's own actions,
 * Duplicate then Archive, in the same order and with the same icons as the
 * right-click menu on its rows. The footer only saves. Pass it as
 * `SheetFormHeader`'s `menu`; create sheets have none.
 */
export function SheetRecordMenu({
  noun,
  onDuplicate,
  onRequestArchive,
  archiveDisabled = false,
  archiveDisabledReason = null,
}: SheetRecordMenuProps) {
  if (!onDuplicate && !onRequestArchive) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label={`${noun} actions`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {onDuplicate ? (
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
        ) : null}
        {onDuplicate && onRequestArchive ? <DropdownMenuSeparator /> : null}
        {onRequestArchive ? (
          <DropdownMenuItem
            variant='destructive'
            disabled={archiveDisabled}
            onClick={onRequestArchive}
          >
            <Archive />
            Archive
          </DropdownMenuItem>
        ) : null}
        {onRequestArchive && archiveDisabled && archiveDisabledReason ? (
          <p className='text-muted-foreground max-w-64 px-1.5 py-1 text-xs'>
            {archiveDisabledReason}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
