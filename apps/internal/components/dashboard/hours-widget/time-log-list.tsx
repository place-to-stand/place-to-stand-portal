'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { Loader2, User, Users } from 'lucide-react'

import { LoadMoreButton } from '@/components/ui/load-more-button'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatHours } from '@pts/ui/numbers'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'

import { MetaLink } from '@/components/ui/meta-link'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { projectTasksHref } from '@/lib/sheets/hrefs'

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
    return <EmptyState className='mt-3' message='No time logged this month.' />
  }

  return (
    <div className='flex flex-col'>
      {/*
        The label keeps its quiet uppercase treatment; separation comes from
        whitespace alone -- a rule here on top of the row dividers below made
        the widget read as a stack of boxes.
      */}
      <div className='flex items-center justify-between pt-4 pb-2'>
        <h3 className='text-muted-foreground text-overline font-semibold tracking-wide uppercase'>
          My time logs
        </h3>
        <span className='text-muted-foreground text-xs tabular-nums'>
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
      {/*
        Pulls out of the card's px-4/py-3 so the rule runs edge to edge and
        the button sits 8px in with 6px above and below -- the same footer
        the My Tasks widget draws.
      */}
      {remaining > 0 ? (
        <div className='-mx-4 -mb-3 border-t px-2 py-1.5'>
          <LoadMoreButton
            onClick={onLoadMore}
            loading={isLoadingMore}
            label={`Load ${Math.min(5, remaining)} more`}
          />
        </div>
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
  // A log can span several tasks; the first names the row and the rest
  // collapse into a count so the primary line stays one line.
  const [firstTask, ...otherTasks] = entry.taskTitles
  const label = firstTask ?? entry.note ?? 'Untitled time log'
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
        className='hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-x-0 inset-y-0.5 z-0 cursor-pointer rounded-md transition outline-none focus-visible:ring-[3px] disabled:cursor-wait'
        aria-label={`Edit time log: ${label}, ${dateLabel}`}
      />
      <div className='pointer-events-none relative z-10 flex items-center gap-3 px-2 py-2'>
        <div className='min-w-0 flex-1'>
          {/* Primary line: the task alone, flush left so the titles stack. */}
          <span className='text-foreground block truncate text-xs font-medium'>
            {label}
            {otherTasks.length ? (
              <span className='text-muted-foreground font-normal'>
                {' '}
                +{otherTasks.length} more
              </span>
            ) : null}
          </span>
          {/* Secondary line: when it happened and where it landed. */}
          <div className='text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs'>
            <span className='bg-muted text-muted-foreground text-micro shrink-0 rounded px-1.5 py-0.5 leading-none tabular-nums'>
              {dateLabel}
            </span>
            {entry.clientName ? (
              <>
                {entry.companyId ? (
                  <MetaLink
                    sheet={{ entity: 'company', id: entry.companyId }}
                    className='pointer-events-auto relative z-20'
                    icon={renderProjectTypeIcon(entry.projectType)}
                  >
                    {entry.clientName}
                  </MetaLink>
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
            <MetaLink
              // A project opens its board, not its sheet.
              href={projectTasksHref(entry) ?? undefined}
              className='pointer-events-auto relative z-20'
              icon={
                <>
                  {entry.clientName
                    ? null
                    : renderProjectTypeIcon(entry.projectType)}
                  <ENTITY_ICONS.project
                    className='size-3 shrink-0'
                    aria-hidden
                  />
                </>
              }
            >
              {entry.projectName}
            </MetaLink>
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
        </span>
      </div>
    </li>
  )
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
    return <ENTITY_ICONS.company className={className} aria-hidden />
  }

  return <ENTITY_ICONS.project className={className} aria-hidden />
}
