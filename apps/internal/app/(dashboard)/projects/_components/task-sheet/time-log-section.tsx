'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatHours } from '@pts/ui/numbers'
import { EntityList } from '@/components/sheets/entity-list'
import { Skeleton } from '@pts/ui/skeleton'
import { getInitials } from '@/lib/users/initials'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { useTaskTimeLogs } from './use-task-time-logs'
import { ENTITY_ICONS } from '@/lib/entity-accents'

type TimeLogSectionProps = {
  taskId: string
  enabled: boolean
  logTimeDisabledReason: string | null
  onLogTime: () => void
  onEditEntry: (entry: TimeLogEntry) => void
}

export function TimeLogSection({
  taskId,
  enabled,
  logTimeDisabledReason,
  onLogTime,
  onEditEntry,
}: TimeLogSectionProps) {
  const { entries, totalHours, isLoading, isError } = useTaskTimeLogs(
    taskId,
    enabled
  )

  return (
    // No bottom padding: the scroll column's gap-6 separates these sections.
    <EntityList
      className='px-6'
      title='Time logs'
      icon={ENTITY_ICONS.timeLog}
      titleAddon={
        <span className='text-muted-foreground text-sm font-normal'>
          {formatHours(totalHours)} logged
        </span>
      }
      add={{
        label: 'Log time',
        onAdd: onLogTime,
        disabledReason: logTimeDisabledReason,
      }}
      isEmpty={entries.length === 0}
      emptyMessage='No time logged yet.'
      status={
        isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-8 w-full' />
            <Skeleton className='h-8 w-full' />
          </div>
        ) : isError ? (
          <p className='text-muted-foreground text-sm'>
            Time logs could not be loaded.
          </p>
        ) : undefined
      }
    >
      <ul className='divide-border divide-y rounded-md border'>
        {entries.map(entry => (
          <li key={entry.id}>
            <button
              type='button'
              onClick={() => onEditEntry(entry)}
              className='hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]'
            >
              {/* Avatar instead of the logger's name: the row has one line
                    for date, hours, person and note, and the note is the part
                    that needs the room. It leads the row — same identity-first
                    reading order as the comments thread above — with the name
                    still reachable by hover and by AT. */}
              <span className='shrink-0' title={resolveLoggerName(entry)}>
                <Avatar size='xs'>
                  {entry.user?.avatar_url ? (
                    <AvatarImage
                      src={`/api/storage/user-avatar/${entry.user.id}`}
                      alt=''
                    />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(resolveLoggerName(entry))}
                  </AvatarFallback>
                </Avatar>
                <span className='sr-only'>
                  Logged by {resolveLoggerName(entry)}
                </span>
              </span>
              <span className='text-muted-foreground w-24 shrink-0 tabular-nums'>
                {formatLoggedOn(entry.logged_on)}
              </span>
              {/* Right-aligned so `0.5h` and `12.5h` line up down the column
                    and the number sits flush against the note. */}
              <span className='w-12 shrink-0 text-right font-medium tabular-nums'>
                {formatHours(entry.hours)}
              </span>
              {entry.note ? (
                <span className='text-muted-foreground min-w-0 flex-1 truncate'>
                  {entry.note}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </EntityList>
  )
}

function formatLoggedOn(loggedOn: string): string {
  return formatCalendarDate(loggedOn) ?? loggedOn
}

function resolveLoggerName(entry: TimeLogEntry): string {
  return (
    entry.user?.full_name?.trim() ||
    entry.user?.email?.split('@')[0] ||
    'Unknown'
  )
}

/**
 * The same Time logs section on a new task, in the same place: logging time
 * is its own record and needs the saved task, so the add button is disabled
 * with that hint and the list shows the empty state.
 */
export function TimeLogSectionPlaceholder() {
  const reason = 'Log time after you save the task.'
  return (
    <EntityList
      className='px-6'
      title='Time logs'
      icon={ENTITY_ICONS.timeLog}
      add={{ label: 'Log time', disabledReason: reason }}
      isEmpty
      emptyMessage={reason}
    />
  )
}
