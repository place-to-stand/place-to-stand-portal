'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { formatCalendarDate } from '@pts/ui/dates'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { ProjectTimeLogDialog } from '@/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { PersonAvatar } from '@/components/ui/user-avatar'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'
import { useTimeLogEditContext } from '@/lib/projects/time-log/use-time-log-edit-context'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { useTimeLogRowActions } from '../_lib/use-time-log-row-actions'

const HOURS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

type TimeLogsTableProps = {
  items: DashboardTimeLogEntry[]
  totalCount: number
  currentPage: number
  pageSize: number
  /** `archive` lists archived logs: no edit, Restore instead of Archive. */
  mode?: 'active' | 'archive'
}

/**
 * One line per log. On the active list a row click (or Edit) opens it in the
 * Log time dialog; archived logs can only be restored.
 */
export function TimeLogsTable({
  items,
  totalCount,
  currentPage,
  pageSize,
  mode = 'active',
}: TimeLogsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const editor = useTimeLogEditContext()
  const actions = useTimeLogRowActions()
  const isArchive = mode === 'archive'

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString())
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }

  if (items.length === 0) {
    return <EmptyState
        message={
          isArchive
            ? 'No archived time logs in this range.'
            : 'No time logged in this range.'
        }
      />
  }

  return (
    <div className='space-y-3'>
      {editor.error ? (
        <p className='text-destructive text-sm' role='alert'>
          {editor.error}
        </p>
      ) : null}
      <div className='overflow-hidden rounded-lg border'>
        <Table density='compact' layout='fixed' stack className='md:min-w-[64rem]'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className='w-[10%]'>Date</TableHead>
              <TableHead className='w-16'>Person</TableHead>
              <TableHead className='w-[14%]'>Client</TableHead>
              <TableHead className='w-[18%]'>Project</TableHead>
              <TableHead className='w-[18%]'>Tasks</TableHead>
              <TableHead className='w-[7%] text-right'>Hours</TableHead>
              <TableHead className='w-[21%]'>Note</TableHead>
              <TableHead className='w-32 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const tasks = item.taskTitles.join(', ')
              return (
                <TableRow
                  key={item.id}
                  {...(isArchive
                    ? {}
                    : {
                        ...getClickableRowProps(() => void editor.open(item.id)),
                        className: CLICKABLE_ROW_CLASS,
                      })}
                >
                  <TableCell className='text-sm tabular-nums'>
                    {editor.openingEntryId === item.id ? (
                      <Loader2 className='size-4 animate-spin' aria-label='Opening' />
                    ) : (
                      formatCalendarDate(item.loggedOn)
                    )}
                  </TableCell>
                  <TableCell label='Person'>
                    <PersonAvatar
                      userId={item.userId}
                      name={item.userName ?? 'Unknown'}
                      hasPhoto={Boolean(item.userAvatarUrl)}
                    />
                  </TableCell>
                  <TableCell className='truncate text-sm' title={item.clientName ?? undefined}>
                    {item.clientName ?? <span className='text-muted-foreground'>—</span>}
                  </TableCell>
                  <TableCell className='truncate text-sm' title={item.projectName}>
                    {item.projectName}
                  </TableCell>
                  <TableCell className='text-muted-foreground truncate text-sm' title={tasks || undefined}>
                    {tasks || '—'}
                  </TableCell>
                  <TableCell className='text-right text-sm font-medium tabular-nums'>
                    {HOURS.format(item.hours)}
                  </TableCell>
                  <TableCell className='text-muted-foreground truncate text-sm' title={item.note ?? undefined}>
                    {item.note || '—'}
                  </TableCell>
                  <TableCell className='text-right max-md:ml-auto'>
                    <RecordRowActions>
                      {isArchive ? (
                        <RecordRowAction
                          kind='restore'
                          entity='time entry'
                          onClick={() => actions.restore(item)}
                          disabled={actions.isMutating}
                          pending={actions.busyEntryId === item.id}
                        />
                      ) : (
                        <>
                          <RecordRowAction
                            kind='edit'
                            entity='time entry'
                            onClick={() => void editor.open(item.id)}
                            pending={editor.openingEntryId === item.id}
                          />
                          <RecordRowAction
                            kind='archive'
                            entity='time entry'
                            onClick={() => actions.archiveConfirm.request(item)}
                            disabled={actions.isMutating}
                            pending={actions.busyEntryId === item.id}
                          />
                        </>
                      )}
                    </RecordRowActions>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
      />
      <ConfirmDialog
        open={actions.archiveConfirm.open}
        title='Archive time entry?'
        description='This removes the log from the project burndown.'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={actions.isMutating}
        onCancel={actions.archiveConfirm.cancel}
        onConfirm={actions.archiveConfirm.confirm}
      />
      {editor.editContext ? (
        <ProjectTimeLogDialog
          {...editor.editContext.params}
          open
          onOpenChange={next => {
            if (!next) editor.close()
          }}
          mode='edit'
          timeLogEntry={editor.editContext.entry}
          onMutationSuccess={() => {
            editor.close()
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
