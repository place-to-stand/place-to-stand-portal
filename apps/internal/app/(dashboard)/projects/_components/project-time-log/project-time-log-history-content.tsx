import { Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'
import type { ProjectTimeLogHistoryState } from '@/lib/projects/time-log/use-project-time-log-history'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

type ProjectTimeLogHistoryContentProps = {
  state: ProjectTimeLogHistoryState
  onEditEntry: (entry: TimeLogEntry) => void
}

export function ProjectTimeLogHistoryContent(
  props: ProjectTimeLogHistoryContentProps
) {
  const { state, onEditEntry } = props
  const {
    logs,
    totalCount,
    isLoading,
    isLoadingMore,
    isError,
    refresh,
    showLoadMore,
    loadMore,
    deleteState,
  } = state

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground text-sm'>
          Showing {logs.length} of {totalCount}
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={refresh}
          disabled={isLoading}
          className='inline-flex items-center gap-2'
        >
          {isLoading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RotateCcw className='size-4' />
          )}
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='size-4 animate-spin' /> Loading time logs…
        </div>
      ) : isError ? (
        <div className='text-destructive border-destructive/40 bg-destructive/10 flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
          <span>Unable to load time logs.</span>
          <Button type='button' variant='outline' size='sm' onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : logs.length === 0 ? (
        <EmptyState message='No time logged for this project yet.' />
      ) : (
        <div className='overflow-hidden rounded-lg border'>
          <Table stack>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead className='min-w-28'>Logged on</TableHead>
                <TableHead className='min-w-20'>Hours</TableHead>
                <TableHead className='min-w-20 text-center'>Tasks</TableHead>
                <TableHead className='min-w-36'>Person</TableHead>
                <TableHead className='w-20 text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <ProjectTimeLogHistoryRow
                  key={log.id}
                  log={log}
                  onDeleteRequest={deleteState.request}
                  onEditRequest={onEditEntry}
                  isDeleting={deleteState.isMutating}
                  pendingDeleteId={deleteState.pendingEntryId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showLoadMore ? (
        <div className='flex justify-center'>
          <Button
            type='button'
            variant='outline'
            onClick={loadMore}
            disabled={isLoading || isLoadingMore}
            className='inline-flex items-center gap-2'
          >
            {isLoadingMore ? <Loader2 className='size-4 animate-spin' /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type ProjectTimeLogHistoryRowProps = {
  log: TimeLogEntry
  onDeleteRequest: (entry: TimeLogEntry) => void
  onEditRequest: (entry: TimeLogEntry) => void
  isDeleting: boolean
  pendingDeleteId: string | null
}

function ProjectTimeLogHistoryRow(props: ProjectTimeLogHistoryRowProps) {
  const { log, onDeleteRequest, onEditRequest, isDeleting, pendingDeleteId } =
    props

  const { open: openSheet } = useSheetParams()
  const authorName = log.user?.full_name ?? log.user?.email ?? 'Unknown user'
  const loggedDate = formatCalendarDate(log.logged_on) ?? 'Unknown date'
  const deleteDisabled = isDeleting
  const deleteReason = deleteDisabled ? 'Removing time log...' : null

  const visibleTaskLinks = (log.linked_tasks ?? []).filter(
    (
      link
    ): link is NonNullable<
      NonNullable<TimeLogEntry['linked_tasks']>[number]
    > => {
      if (!link) {
        return false
      }
      if (link.deleted_at) {
        return false
      }
      if (!link.task || link.task.deleted_at) {
        return false
      }
      return true
    }
  )

  return (
    <TableRow>
      <TableCell className='max-md:first:basis-auto'>
        <div className='flex flex-col'>
          <span className='font-medium'>{loggedDate}</span>
        </div>
      </TableCell>
      <TableCell className='font-semibold'>
        {HOURS_FORMATTER.format(Number(log.hours ?? 0))} hrs
      </TableCell>
      <TableCell label='Tasks' className='text-sm tabular-nums md:text-center'>
        <LinkedRecordsHoverCell
          count={visibleTaskLinks.length}
          icon={ENTITY_ICONS.task}
          iconClassName={ENTITY_ACCENTS.task.icon}
          ariaLabel={`${visibleTaskLinks.length} ${visibleTaskLinks.length === 1 ? 'task' : 'tasks'}`}
          items={visibleTaskLinks.map(link => ({
            id: link.task?.id ?? link.id,
            label: link.task?.title ?? 'Untitled task',
            onSelect: link.task
              ? () => openSheet('task', link.task!.id)
              : undefined,
          }))}
        />
      </TableCell>
      <TableCell>
        <span className='line-clamp-2 text-sm'>{authorName}</span>
      </TableCell>
      <TableCell className='text-right max-md:ml-auto'>
        <RecordRowActions>
          <RecordRowAction
            kind='edit'
            entity='time log'
            onClick={() => onEditRequest(log)}
          />
          <RecordRowAction
            kind='archive'
            entity='time log'
            onClick={() => onDeleteRequest(log)}
            disabled={deleteDisabled}
            disabledReason={deleteReason}
            pending={isDeleting && pendingDeleteId === log.id}
          />
        </RecordRowActions>
      </TableCell>
    </TableRow>
  )
}
