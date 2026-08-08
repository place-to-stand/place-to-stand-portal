'use client'

import { format, parseISO } from 'date-fns'
import { Clock, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { useTaskTimeLogs } from './use-task-time-logs'

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

  const logTimeDisabled = Boolean(logTimeDisabledReason)

  return (
    <section className='space-y-3 px-6' aria-label='Time logged on this task'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Clock className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Time</span>
          <span className='text-muted-foreground text-sm'>
            {totalHours}h logged
          </span>
        </div>
        <DisabledFieldTooltip
          disabled={logTimeDisabled}
          reason={logTimeDisabledReason}
        >
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={logTimeDisabled}
            onClick={onLogTime}
            className='h-7 gap-1.5 px-2 text-xs'
          >
            <Plus className='h-3.5 w-3.5' />
            Log time
          </Button>
        </DisabledFieldTooltip>
      </div>
      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
        </div>
      ) : isError ? (
        <p className='text-muted-foreground text-sm'>
          Time logs could not be loaded.
        </p>
      ) : entries.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No time logged yet.</p>
      ) : (
        <ul className='divide-border divide-y rounded-md border'>
          {entries.map(entry => (
            <li key={entry.id}>
              <button
                type='button'
                onClick={() => onEditEntry(entry)}
                className='hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors'
              >
                <span className='text-muted-foreground w-24 shrink-0 tabular-nums'>
                  {formatLoggedOn(entry.logged_on)}
                </span>
                <span className='w-14 shrink-0 font-medium tabular-nums'>
                  {entry.hours}h
                </span>
                <span className='text-muted-foreground shrink-0'>
                  {resolveLoggerName(entry)}
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
      )}
    </section>
  )
}

function formatLoggedOn(loggedOn: string): string {
  try {
    return format(parseISO(loggedOn), 'MMM d, yyyy')
  } catch {
    return loggedOn
  }
}

function resolveLoggerName(entry: TimeLogEntry): string {
  return (
    entry.user?.full_name?.trim() ||
    entry.user?.email?.split('@')[0] ||
    'Unknown'
  )
}
