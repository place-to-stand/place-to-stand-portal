'use client'

import { formatRelativeTime } from '@pts/ui/dates'
import { Button } from '@pts/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@pts/ui/alert-dialog'

import type { SaveConflict } from '@/lib/sheets/save-conflict/types'
import type { SaveConflictGuard } from '@/lib/sheets/save-conflict/use-save-conflict'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'

type SaveConflictDialogProps = {
  guard: SaveConflictGuard
  /** What the sheet edits, in lower case: "company", "task". */
  noun: string
  /** The sheet's Save, run again in the mode the refused save used. */
  onOverwrite: (mode: SheetSaveMode) => void
  /**
   * Drops the user's edits and shows the record as it is now: refetch it
   * and re-seed the form from the new version.
   */
  onLoadTheirs: () => void
}

/** "Kris saved this company 2 minutes ago, after you opened it." */
function headline(conflict: SaveConflict, noun: string): string {
  const latest = conflict.changes[0]
  const when = formatRelativeTime(latest?.at ?? conflict.savedAt) ?? 'just now'
  // No activity row to name anyone (a script, or one not logged yet).
  if (!latest?.by) return `This ${noun} changed ${when}, after you opened it.`
  return `${latest.by} saved this ${noun} ${when}, after you opened it.`
}

/**
 * Shown when a sheet's Save is refused because someone else saved the same
 * record first. Nothing was written; the user picks what happens next.
 */
export function SaveConflictDialog({
  guard,
  noun,
  onOverwrite,
  onLoadTheirs,
}: SaveConflictDialogProps) {
  const { conflict } = guard
  const onKeepEditing = guard.dismiss
  return (
    <AlertDialog
      open={conflict !== null}
      onOpenChange={next => {
        if (!next) onKeepEditing()
      }}
    >
      <AlertDialogContent onBackdropClick={onKeepEditing}>
        <AlertDialogHeader>
          <AlertDialogTitle>Your changes weren’t saved</AlertDialogTitle>
          {conflict ? (
            <AlertDialogDescription>
              {headline(conflict, noun)}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {conflict && conflict.changes.length > 0 ? (
          <ul className='text-muted-foreground space-y-1 text-sm'>
            {conflict.changes.map(change => (
              <li key={`${change.at}:${change.summary}`}>
                <span className='text-foreground font-medium'>
                  {change.by ?? 'Someone'}
                </span>
                : {change.summary}
              </li>
            ))}
          </ul>
        ) : null}
        <p className='text-muted-foreground text-sm'>
          Overwrite with mine saves everything on your sheet over their changes.
          Load theirs drops your edits and shows the {noun} as it is now.
        </p>
        <AlertDialogFooter>
          <Button type='button' variant='outline' onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              guard.dismiss()
              onLoadTheirs()
            }}
          >
            Load theirs
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={() => onOverwrite(guard.overwrite())}
          >
            Overwrite with mine
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
