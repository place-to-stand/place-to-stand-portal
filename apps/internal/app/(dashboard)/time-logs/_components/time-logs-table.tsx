'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import { useRouter } from 'next/navigation'
import { formatCalendarDate } from '@pts/ui/dates'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import { formatHours } from '@pts/ui/numbers'
import { EmptyValue } from '@/components/table/empty-value'
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
import { RecordContextMenu } from '@/components/table/record-context-menu'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { PersonAvatar } from '@/components/ui/user-avatar'
import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { companySheetHref, projectTasksHref } from '@/lib/sheets/hrefs'
import { cn } from '@/lib/utils'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'
import { useTimeLogEditContext } from '@/lib/projects/time-log/use-time-log-edit-context'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { useTimeLogRowActions } from '../_lib/use-time-log-row-actions'
import { usePageParam } from '@/hooks/use-page-param'
import {
  BulkActionBar,
  RowSelectionProvider,
  SelectAllHead,
  SelectRowCell,
  useRowSelection,
} from '@/components/table/bulk-select'

type TimeLogsTableProps = {
  items: DashboardTimeLogEntry[]
  totalCount: number
  /** Hours across every page of the filtered logs: the footer's total. */
  totalHours: number
  currentPage: number
  pageSize: number
  /** `archive` lists archived logs: no edit, Restore instead of Archive. */
  mode?: 'active' | 'archive'
  /** Validated `?sort=`, or undefined for the default (newest first). */
  sort: string | undefined
}

/**
 * One line per log. On the active list a row click (or Edit) opens it in the
 * Log time dialog; archived logs can only be restored.
 */
export function TimeLogsTable({
  items,
  totalCount,
  totalHours,
  currentPage,
  pageSize,
  mode = 'active',
  sort,
}: TimeLogsTableProps) {
  const router = useRouter()
  const { open: openSheet } = useSheetParams()
  const { update } = useListParams({
    basePath: mode === 'archive' ? '/time-logs/archive' : '/time-logs',
    resetKeys: ['page'],
  })
  // The same sortable headers as Companies and the other lists.
  const sortHead = (
    field: string,
    label: string,
    className: string,
    align?: 'center'
  ) => (
    <SortableTableHead
      field={field}
      sort={sort}
      defaultSort='date:desc'
      onSortChange={next => update({ sort: next })}
      className={className}
      align={align}
    >
      {label}
    </SortableTableHead>
  )
  const editor = useTimeLogEditContext()
  const actions = useTimeLogRowActions()
  const isArchive = mode === 'archive'
  const selection = useRowSelection(
    items.map(item => item.id),
    totalCount
  )

  const goToPage = usePageParam()

  // A page past the end (after archiving its last row, or a stale link)
  // goes back to the last page that has rows.
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))
  const pastEnd = items.length === 0 && totalCount > 0 && currentPage > lastPage
  useEffect(() => {
    if (pastEnd) goToPage(lastPage)
  })

  if (items.length === 0) {
    return (
      <EmptyState
        message={
          isArchive
            ? 'No archived time logs in this range.'
            : 'No time logged in this range.'
        }
      />
    )
  }

  return (
    <div className='space-y-3'>
      {editor.error ? (
        <p className='text-destructive text-sm' role='alert'>
          {editor.error}
        </p>
      ) : null}
      <div className='overflow-hidden rounded-lg border'>
        <RowSelectionProvider selection={selection} entity='timeLog'>
          <Table
            density='compact'
            layout='fixed'
            stack
            className='md:min-w-[64rem]'
          >
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <SelectAllHead />
                {sortHead('hours', 'Hours', 'w-[9%]')}
                {sortHead('date', 'Date', 'w-[11%]')}
                {sortHead('person', 'Person', 'w-[8%]', 'center')}
                {sortHead('client', 'Client', 'w-[24%]')}
                {/* Unsized on purpose: in a fixed layout the one auto column absorbs the
                slack, so the select and Actions columns keep their widths. */}
                {sortHead('project', 'Project', '')}
                <TableHead className='w-[9%] text-center'>Tasks</TableHead>
                <TableHead className='w-32 text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                return (
                  <RecordContextMenu
                    key={item.id}
                    entity='time-log'
                    id={item.id}
                    onEdit={() => void editor.open(item.id)}
                    // Archived logs don't open; the list only restores them.
                    editable={!isArchive}
                    onArchive={
                      isArchive
                        ? undefined
                        : () => actions.archiveConfirm.request(item)
                    }
                    onRestore={
                      isArchive ? () => actions.restore(item) : undefined
                    }
                    pending={actions.isMutating}
                  >
                    <TableRow
                      data-selected={selection.isSelected(item.id) || undefined}
                      {...(isArchive
                        ? {}
                        : {
                            ...getClickableRowProps(
                              () => void editor.open(item.id)
                            ),
                            className: CLICKABLE_ROW_CLASS,
                          })}
                    >
                      <SelectRowCell
                        id={item.id}
                        label={`${formatHours(item.hours)} on ${item.projectName}`}
                      />
                      {/* Hours first: it's what you scan a time log for. */}
                      <TableCell className='text-sm font-medium tabular-nums'>
                        <span className='inline-flex items-center gap-2'>
                          <ENTITY_ICONS.timeLog
                            className={cn(
                              ENTITY_ACCENTS.timeLog.icon,
                              'h-4 w-4 shrink-0'
                            )}
                          />
                          {formatHours(item.hours)}
                        </span>
                      </TableCell>
                      <TableCell label='Date' className='text-sm tabular-nums'>
                        {formatCalendarDate(item.loggedOn)}
                      </TableCell>
                      <TableCell label='Person'>
                        <div className='flex items-center justify-center'>
                          <PersonAvatar
                            userId={item.userId}
                            name={item.userName ?? 'Unknown'}
                            hasPhoto={Boolean(item.userAvatarUrl)}
                          />
                        </div>
                      </TableCell>
                      <TableCell label='Client' className='text-sm'>
                        {item.clientName ? (
                          <div className='flex min-w-0 items-center gap-2'>
                            <ENTITY_ICONS.client
                              className={cn(
                                ENTITY_ACCENTS.client.icon,
                                'h-4 w-4 shrink-0'
                              )}
                            />
                            {item.companyId ? (
                              // The row ignores clicks on links.
                              <Link
                                href={companySheetHref(item.companyId)}
                                title={item.clientName}
                                className='hover:text-foreground truncate-link transition hover:underline'
                              >
                                {item.clientName}
                              </Link>
                            ) : (
                              <span
                                className='truncate'
                                title={item.clientName}
                              >
                                {item.clientName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <EmptyValue />
                        )}
                      </TableCell>
                      <TableCell label='Project' className='text-sm'>
                        <div className='flex min-w-0 items-center gap-2'>
                          <ENTITY_ICONS.project
                            className={cn(
                              ENTITY_ACCENTS.project.icon,
                              'h-4 w-4 shrink-0'
                            )}
                          />
                          {projectTasksHref(item) ? (
                            <Link
                              href={projectTasksHref(item)!}
                              title={item.projectName}
                              className='hover:text-foreground truncate-link transition hover:underline'
                            >
                              {item.projectName}
                            </Link>
                          ) : (
                            <span className='truncate' title={item.projectName}>
                              {item.projectName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        label='Tasks'
                        className='text-sm tabular-nums md:text-center'
                      >
                        <LinkedRecordsHoverCell
                          withIcon
                          count={item.tasks.length}
                          icon={ENTITY_ICONS.task}
                          iconClassName={ENTITY_ACCENTS.task.icon}
                          ariaLabel={`${item.tasks.length} ${item.tasks.length === 1 ? 'task' : 'tasks'}`}
                          items={item.tasks.map(task => ({
                            id: task.id,
                            label: task.title,
                            onSelect: () => openSheet('task', task.id),
                          }))}
                        />
                      </TableCell>
                      <TableCell className='text-right max-md:ml-auto'>
                        <RecordRowActions>
                          {isArchive ? (
                            <RecordRowAction
                              kind='restore'
                              entity='time log'
                              onClick={() => actions.restore(item)}
                              disabled={actions.isMutating}
                              pending={actions.busyEntryId === item.id}
                            />
                          ) : (
                            <>
                              <RecordRowAction
                                kind='edit'
                                entity='time log'
                                onClick={() => void editor.open(item.id)}
                                pending={editor.openingEntryId === item.id}
                              />
                              <RecordRowAction
                                kind='archive'
                                entity='time log'
                                onClick={() =>
                                  actions.archiveConfirm.request(item)
                                }
                                disabled={actions.isMutating}
                                pending={actions.busyEntryId === item.id}
                              />
                            </>
                          )}
                        </RecordRowActions>
                      </TableCell>
                    </TableRow>
                  </RecordContextMenu>
                )
              })}
            </TableBody>
          </Table>
        </RowSelectionProvider>
      </div>
      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        summary={
          <>
            <span className='text-muted-foreground'>Total: </span>
            <span className='font-semibold tabular-nums'>
              {formatHours(totalHours)}
            </span>
          </>
        }
      />
      <BulkActionBar
        selection={selection}
        entity='timeLog'
        mode={mode}
        archiveExtra="They no longer count toward their projects' hours."
      />
      <ArchiveConfirmDialog
        open={actions.archiveConfirm.open}
        entity='time log'
        name='this time log'
        list='time logs'
        extra="It no longer counts toward the project's hours."
        pending={actions.isMutating}
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
