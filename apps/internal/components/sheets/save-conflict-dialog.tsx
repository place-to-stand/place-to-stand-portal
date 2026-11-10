'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@pts/ui/alert-dialog'
import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'

import { emptyLabel } from '@/components/activity/activity-change-list'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { FieldChange } from '@/lib/activity/changes'
import { getActorDisplayName } from '@/lib/activity/feed-highlights'
import type { ActivityReferences } from '@/lib/activity/types'
import {
  mergeFields,
  plainValue,
  resolvable,
  same,
} from '@/lib/sheets/save-conflict/conflict-values'
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
  /**
   * The values on this sheet now, keyed like the activity log's fields
   * (`form.getValues`). Lets each changed field show what Save would write
   * over it. Fields it doesn't name show only before and after.
   */
  yours?: () => Record<string, unknown>
}

/** Who saved, in the words the dialog uses. */
type Saver = {
  /** "Kris Crawford", "You", "Someone". */
  full: string
  /** "Kris's", "the saved", "their". */
  versionOf: string
  self: boolean
}

/**
 * Shown when a sheet's Save is refused because someone else saved the same
 * record first. Nothing was written. Written for people who don't think in
 * diffs: who changed what, in plain sentences, each changed field as what
 * they saved next to what this sheet holds, and three choices that say what
 * each one keeps.
 */
export function SaveConflictDialog({
  guard,
  noun,
  onOverwrite,
  onLoadTheirs,
  yours,
}: SaveConflictDialogProps) {
  const { userId } = useViewerAccess()
  const { conflict } = guard
  const saver = describeSaver(conflict, userId)
  const fields = conflict ? mergeFields(conflict.changes) : []
  const mine = conflict && yours ? yours() : null
  const references = conflict?.changes[0]?.references
  const when = conflict
    ? formatRelativeTime(conflict.changes[0]?.created_at ?? conflict.savedAt)
    : ''

  const theirsLabel = saver.self
    ? 'Use the saved version'
    : `Use ${saver.versionOf} version`
  const mineLabel = saver.self
    ? 'Save this tab’s version'
    : `Save mine over ${saver.versionOf}`

  return (
    <AlertDialog
      open={conflict !== null}
      onOpenChange={next => {
        if (!next) guard.dismiss()
      }}
    >
      <AlertDialogContent
        onBackdropClick={guard.dismiss}
        className='sm:max-w-xl'
      >
        <AlertDialogHeader>
          <AlertDialogTitle className='leading-snug'>
            {saver.self
              ? `You saved this ${noun} in another tab`
              : `${saver.full} changed this ${noun}${when ? ` ${when}` : ''}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {saver.self
              ? 'Your changes in this tab aren’t saved yet.'
              : 'They saved while you were editing. Your changes aren’t saved yet.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {conflict ? (
          <ConflictFields
            fields={fields}
            mine={mine}
            saver={saver}
            references={references}
            targetType={conflict.changes[0]?.target_type ?? ''}
            summary={conflict.changes[0]?.summary}
          />
        ) : null}
        <AlertDialogFooter>
          <Button type='button' variant='outline' onClick={guard.dismiss}>
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
            {theirsLabel}
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={() => onOverwrite(guard.overwrite())}
          >
            {mineLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function describeSaver(
  conflict: SaveConflict | null,
  userId: string | null
): Saver {
  const actors = new Set(
    (conflict?.changes ?? []).map(log => log.actor?.id ?? null)
  )
  const latest = conflict?.changes[0]
  if (!latest || actors.size > 1 || !latest.actor) {
    return {
      full: actors.size > 1 ? 'Others' : 'Someone',
      versionOf: 'their',
      self: false,
    }
  }
  if (latest.actor.id === userId) {
    return { full: 'You', versionOf: 'the saved', self: true }
  }
  const full = getActorDisplayName(latest)
  const first = full.split(' ')[0] || full
  return { full, versionOf: `${first}’s`, self: false }
}

function ConflictFields({
  fields,
  mine,
  saver,
  references,
  targetType,
  summary,
}: {
  fields: FieldChange[]
  mine: Record<string, unknown> | null
  saver: Saver
  references?: ActivityReferences
  targetType: string
  summary?: string
}) {
  if (fields.length === 0) {
    return summary ? (
      <p className='bg-muted/40 rounded-md border p-3 text-sm'>{summary}</p>
    ) : null
  }
  const theirLabel = saver.self
    ? 'Saved'
    : saver.versionOf === 'their'
      ? 'They saved'
      : `${saver.versionOf.replace(/’s$/, '')} saved`
  return (
    <div className='flex max-h-72 flex-col gap-3 overflow-y-auto'>
      <p className='text-sm font-medium'>
        {saver.self ? 'What you changed there' : 'What they changed'}
      </p>
      {fields.map(field => {
        const after = plainValue(field, field.after, targetType, references)
        const before = plainValue(field, field.before, targetType, references)
        const hasMine =
          mine !== null &&
          field.key in mine &&
          resolvable(field, mine[field.key], references)
        const minePlain = hasMine
          ? plainValue(field, mine[field.key], targetType, references)
          : null
        const mineIsOld = hasMine && same(minePlain, before)
        return (
          <section
            key={field.key}
            className='bg-muted/40 rounded-md border p-3'
            aria-label={field.label}
          >
            <h3 className='mb-2 text-sm font-medium'>{field.label}</h3>
            <dl className='grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm'>
              {hasMine ? null : (
                <Line label='Before' value={before} field={field} muted />
              )}
              <Line label={theirLabel} value={after} field={field} />
              {hasMine ? (
                <Line
                  label={saver.self ? 'This tab' : 'Your sheet'}
                  value={minePlain}
                  field={field}
                  note={
                    mineIsOld
                      ? `You didn’t change this. Saving yours puts the old ${field.label.toLowerCase()} back.`
                      : null
                  }
                />
              ) : null}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

function Line({
  label,
  value,
  field,
  muted = false,
  note = null,
}: {
  label: string
  value: string | null
  field: FieldChange
  muted?: boolean
  note?: string | null
}) {
  return (
    <>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0'>
        <span
          className={
            value === null
              ? 'text-muted-foreground italic'
              : muted
                ? 'text-muted-foreground line-clamp-4 break-words whitespace-pre-line'
                : 'line-clamp-4 break-words whitespace-pre-line'
          }
        >
          {value ?? emptyLabel(field)}
        </span>
        {note ? (
          <span className='text-warning mt-0.5 block text-xs'>{note}</span>
        ) : null}
      </dd>
    </>
  )
}
