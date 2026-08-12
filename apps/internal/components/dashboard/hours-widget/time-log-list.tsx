'use client'

import Link from 'next/link'
import { Building2, FolderKanban, Loader2, User, Users } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@/lib/dates'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'

import { formatHours } from './month-cursor'

type TimeLogListProps = {
  items: DashboardTimeLogEntry[]
  totalCount: number
  isLoadingMore: boolean
  onLoadMore: () => void
  onOpenEntry: (entryId: string) => void
  /** Id of the row whose edit context is currently being fetched. */
  openingEntryId: string | null
  error: string | null
}

export function TimeLogList({
  items,
  totalCount,
  isLoadingMore,
  onLoadMore,
  onOpenEntry,
  openingEntryId,
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
      {/*
        Full-strength foreground text and a filled count chip: at muted 11px
        uppercase this heading read as one more row of metadata and vanished
        when scanning the widget. It is a section break, so it looks like one.
      */}
      <div className='flex items-center justify-between pt-4 pb-2'>
        <h3 className='text-foreground text-xs font-semibold'>My time logs</h3>
        <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums'>
          {items.length} of {totalCount}
        </span>
      </div>
      {/*
        -mx-2 lets each row's own px-2 push the hover surface past the text on
        both sides, so the highlight has breathing room while the text stays
        aligned with the stat cards above.
      */}
      <ul className='divide-border -mx-2 divide-y'>
        {items.map(entry => (
          <TimeLogRow
            key={entry.id}
            entry={entry}
            onOpen={onOpenEntry}
            isOpening={openingEntryId === entry.id}
          />
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

function TimeLogRow({
  entry,
  onOpen,
  isOpening,
}: {
  entry: DashboardTimeLogEntry
  onOpen: (entryId: string) => void
  isOpening: boolean
}) {
  const projectHref = getProjectHref(entry)
  const clientHref = getClientHref(entry)
  // A log can span several tasks; the first names the row and the rest
  // collapse into a count so the primary line stays one line.
  const [firstTask, ...otherTasks] = entry.taskTitles
  const label = firstTask ?? entry.note ?? 'Untitled entry'
  const dateLabel = formatCalendarDate(entry.loggedOn, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <li className='group relative'>
      {/*
        Full-bleed overlay button rather than wrapping the row: the project
        link on the second line needs to stay independently clickable, which
        it does by sitting above this on the z-axis.
      */}
      <button
        type='button'
        onClick={() => onOpen(entry.id)}
        disabled={isOpening}
        className='hover:bg-muted/60 focus-visible:ring-primary focus-visible:ring-offset-background absolute inset-0 z-0 cursor-pointer rounded-md transition focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-wait'
        aria-label={`Edit time log: ${label}, ${dateLabel}`}
      />
      <div className='pointer-events-none relative z-10 flex items-center gap-3 px-2 py-2'>
        <div className='min-w-0 flex-1'>
          {/* Primary line: when and what. */}
          <div className='flex items-baseline gap-2'>
            <span className='text-muted-foreground shrink-0 text-[11px] tabular-nums'>
              {dateLabel}
            </span>
            <span className='text-foreground min-w-0 flex-1 truncate text-xs font-medium'>
              {label}
              {otherTasks.length ? (
                <span className='text-muted-foreground font-normal'>
                  {' '}
                  +{otherTasks.length} more
                </span>
              ) : null}
            </span>
          </div>
          {/* Secondary line: where it landed. */}
          <div className='text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]'>
            {entry.clientName ? (
              <>
                {clientHref ? (
                  <Link
                    href={clientHref}
                    className='hover:text-foreground pointer-events-auto relative z-20 inline-flex min-w-0 items-center gap-1 underline-offset-4 transition hover:underline'
                  >
                    {renderProjectTypeIcon(entry.projectType)}
                    <span className='truncate'>{entry.clientName}</span>
                  </Link>
                ) : (
                  <span className='inline-flex min-w-0 items-center gap-1'>
                    {renderProjectTypeIcon(entry.projectType)}
                    <span className='truncate'>{entry.clientName}</span>
                  </span>
                )}
                <span aria-hidden className='shrink-0 opacity-50'>
                  ·
                </span>
              </>
            ) : null}
            {projectHref ? (
              <Link
                href={projectHref}
                className='hover:text-foreground pointer-events-auto relative z-20 inline-flex min-w-0 items-center gap-1 underline-offset-4 transition hover:underline'
              >
                {entry.clientName
                  ? null
                  : renderProjectTypeIcon(entry.projectType)}
                <FolderKanban className='size-3 shrink-0' aria-hidden />
                <span className='truncate'>{entry.projectName}</span>
              </Link>
            ) : (
              <span className='inline-flex min-w-0 items-center gap-1'>
                {entry.clientName
                  ? null
                  : renderProjectTypeIcon(entry.projectType)}
                <FolderKanban className='size-3 shrink-0' aria-hidden />
                <span className='truncate'>{entry.projectName}</span>
              </span>
            )}
          </div>
        </div>
        {/*
          The hours sit in their own column, centred against both lines, so the
          number a scan is looking for is the one thing that isn't competing
          for the primary line.
        */}
        <span className='text-foreground inline-flex shrink-0 items-center gap-1.5 text-base leading-none font-semibold tabular-nums'>
          {isOpening ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden />
          ) : null}
          {formatHours(entry.hours)}
          <span className='text-muted-foreground text-[11px] font-normal'>
            h
          </span>
        </span>
      </div>
    </li>
  )
}

function getProjectHref(entry: DashboardTimeLogEntry) {
  if (!entry.projectSlug) {
    return null
  }

  // The tasks tab is a project's default view -- same target the My Tasks
  // widget uses, so both widgets land in the same place.
  if (entry.projectType === 'INTERNAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${entry.projectSlug}/tasks`
  }

  if (entry.projectType === 'PERSONAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${entry.projectSlug}/tasks`
  }

  if (!entry.clientSlug) {
    return null
  }

  return `/projects/${entry.clientSlug}/${entry.projectSlug}/tasks`
}

function getClientHref(entry: DashboardTimeLogEntry) {
  if (!entry.clientSlug) {
    return null
  }

  return `/clients/${entry.clientSlug}`
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
