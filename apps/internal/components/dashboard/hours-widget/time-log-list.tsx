'use client'

import Link from 'next/link'
import { Building2, FolderKanban, Loader2, User, Users } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'

import { formatHours } from './month-cursor'

type TimeLogListProps = {
  items: DashboardTimeLogEntry[]
  totalCount: number
  isLoadingMore: boolean
  onLoadMore: () => void
  error: string | null
}

export function TimeLogList({
  items,
  totalCount,
  isLoadingMore,
  onLoadMore,
  error,
}: TimeLogListProps) {
  const remaining = Math.max(0, totalCount - items.length)

  if (!items.length) {
    return (
      <p className='text-muted-foreground border-t pt-3 text-xs'>
        No time logged this month.
      </p>
    )
  }

  return (
    <div className='flex flex-col border-t'>
      <div className='flex items-center justify-between pt-3 pb-1'>
        <h3 className='text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'>
          My time logs
        </h3>
        <span className='text-muted-foreground text-[11px] tabular-nums'>
          {items.length} of {totalCount}
        </span>
      </div>
      <ul className='divide-border divide-y'>
        {items.map(entry => (
          <TimeLogRow key={entry.id} entry={entry} />
        ))}
      </ul>
      {error ? <p className='text-destructive pt-2 text-xs'>{error}</p> : null}
      {remaining > 0 ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='mt-1 h-7 w-full text-xs'
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden />
              Loading...
            </>
          ) : (
            `Load ${Math.min(5, remaining)} more`
          )}
        </Button>
      ) : null}
    </div>
  )
}

function TimeLogRow({ entry }: { entry: DashboardTimeLogEntry }) {
  const projectHref = getProjectHref(entry)
  const contextLabel = getContextLabel(entry)
  // A log can span several tasks; the first names the row and the rest
  // collapse into a count so the line stays one line.
  const [firstTask, ...otherTasks] = entry.taskTitles
  const detail = firstTask ?? entry.note ?? null

  return (
    <li className='flex items-start justify-between gap-3 py-2'>
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-[11px]'>
          <span className='tabular-nums'>
            {formatCalendarDate(entry.loggedOn, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {projectHref ? (
            <Link
              href={projectHref}
              className='hover:text-foreground inline-flex min-w-0 items-center gap-1 underline-offset-4 transition hover:underline'
            >
              {renderProjectTypeIcon(entry.projectType)}
              <span className='truncate'>{contextLabel}</span>
            </Link>
          ) : (
            <span className='inline-flex min-w-0 items-center gap-1'>
              {renderProjectTypeIcon(entry.projectType)}
              <span className='truncate'>{contextLabel}</span>
            </span>
          )}
        </div>
        {detail ? (
          <p className='text-foreground mt-0.5 truncate text-xs'>
            {detail}
            {otherTasks.length ? (
              <span className='text-muted-foreground'>
                {' '}
                +{otherTasks.length} more
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          'text-foreground shrink-0 text-xs font-semibold tabular-nums'
        )}
      >
        {formatHours(entry.hours)}h
      </span>
    </li>
  )
}

function getContextLabel(entry: DashboardTimeLogEntry) {
  if (entry.clientName) {
    return `${entry.clientName} · ${entry.projectName}`
  }

  return entry.projectName
}

function getProjectHref(entry: DashboardTimeLogEntry) {
  if (!entry.projectSlug) {
    return null
  }

  if (entry.projectType === 'INTERNAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${entry.projectSlug}/time-logs`
  }

  if (entry.projectType === 'PERSONAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${entry.projectSlug}/time-logs`
  }

  if (!entry.clientSlug) {
    return null
  }

  return `/projects/${entry.clientSlug}/${entry.projectSlug}/time-logs`
}

function renderProjectTypeIcon(projectType: string) {
  const className = 'size-3 shrink-0'

  if (projectType === 'INTERNAL') {
    return <Users className={className} aria-hidden />
  }

  if (projectType === 'PERSONAL') {
    return <User className={className} aria-hidden />
  }

  if (projectType === 'CLIENT') {
    return <Building2 className={className} aria-hidden />
  }

  return <FolderKanban className={className} aria-hidden />
}
