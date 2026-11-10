'use client'

import { formatRelativeTime } from '@pts/ui/dates'

import { ActivityChangeList } from '@/components/activity/activity-change-list'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { ChoiceDialog } from '@/components/ui/choice-dialog'
import { UserAvatar } from '@/components/ui/user-avatar'
import { getActivityChanges } from '@/lib/activity/changes'
import { getActorDisplayName } from '@/lib/activity/feed-highlights'
import type { ActivityLogWithActor } from '@/lib/activity/types'
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

/**
 * Shown when a sheet's Save is refused because someone else saved the same
 * record first. Nothing was written. It says who saved and when, lists
 * their changes field by field (as History shows them), and offers three
 * choices, each with what it does.
 */
export function SaveConflictDialog({
  guard,
  noun,
  onOverwrite,
  onLoadTheirs,
}: SaveConflictDialogProps) {
  const { userId } = useViewerAccess()
  const { conflict } = guard
  return (
    <ChoiceDialog
      open={conflict !== null}
      title={conflict ? headline(conflict, noun, userId) : ''}
      description='Your changes weren’t saved. Nothing is lost yet.'
      choices={[
        {
          key: 'keep',
          label: 'Keep editing',
          detail: 'Back to your edits. Nothing is saved.',
          onSelect: guard.dismiss,
        },
        {
          key: 'theirs',
          label: 'Load theirs',
          detail: `Drop your edits and show the ${noun} as it is now.`,
          onSelect: () => {
            guard.dismiss()
            onLoadTheirs()
          },
        },
        {
          key: 'mine',
          label: 'Overwrite with mine',
          detail: 'Save everything on your sheet over their changes.',
          tone: 'destructive',
          onSelect: () => onOverwrite(guard.overwrite()),
        },
      ]}
    >
      {conflict && conflict.changes.length > 0 ? (
        <ol className='bg-muted/40 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border p-3'>
          {conflict.changes.map(log => (
            <ConflictChange key={log.id} log={log} userId={userId} />
          ))}
        </ol>
      ) : null}
    </ChoiceDialog>
  )
}

/** "Kris Crawford saved this company 2 minutes ago". */
function headline(
  conflict: SaveConflict,
  noun: string,
  userId: string | null
): string {
  const latest = conflict.changes[0]
  const when = formatRelativeTime(latest?.created_at ?? conflict.savedAt)
  const suffix = when ? ` ${when}` : ''
  // No activity row to name anyone (a script, or one not logged yet).
  if (!latest) return `This ${noun} changed${suffix}`
  return `${actorName(latest, userId)} saved this ${noun}${suffix}`
}

/** Your own save from another sheet or tab reads as yours. */
function actorName(log: ActivityLogWithActor, userId: string | null): string {
  return log.actor?.id && log.actor.id === userId
    ? 'You'
    : getActorDisplayName(log)
}

/**
 * One save: who and when on one line, then each changed field as
 * "Label  before → after", the rows History uses. A save that recorded no
 * fields shows its summary instead.
 */
function ConflictChange({
  log,
  userId,
}: {
  log: ActivityLogWithActor
  userId: string | null
}) {
  const changes = getActivityChanges(log)
  const hasRows =
    changes.fields.length > 0 ||
    changes.memberships.length > 0 ||
    changes.facts.length > 0
  return (
    <li>
      <div className='flex items-center gap-1.5 text-sm leading-5'>
        <UserAvatar
          size='xs'
          userId={log.actor?.id}
          name={getActorDisplayName(log)}
          hasPhoto={Boolean(log.actor?.avatar_url)}
          alt=''
        />
        <span className='font-medium'>{actorName(log, userId)}</span>
        <time
          dateTime={log.created_at}
          className='text-muted-foreground text-xs'
        >
          {formatRelativeTime(log.created_at)}
        </time>
      </div>
      {hasRows ? (
        <ActivityChangeList
          fields={changes.fields}
          memberships={changes.memberships}
          facts={changes.facts}
          targetType={log.target_type}
          references={log.references}
        />
      ) : (
        <p className='text-muted-foreground mt-0.5 pl-6.5 text-sm'>
          {log.summary}
        </p>
      )}
    </li>
  )
}
