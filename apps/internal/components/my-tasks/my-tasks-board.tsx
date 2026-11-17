'use client'

import { useCallback, useMemo, useState } from 'react'
import { DndContext } from '@dnd-kit/core'

import { KanbanColumn } from '@/app/(dashboard)/projects/_components/kanban-column'
import { TaskDragOverlay } from '@/app/(dashboard)/projects/_components/task-drag-overlay'
import { produceGroupReorderUpdate } from './my-tasks-group-move'
import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import { useScrollPersistence } from '@/hooks/use-scroll-persistence'
import { useColumnScrollPersistence } from '@/hooks/use-column-scroll-persistence'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '@/lib/projects/board/board-selectors'
import {
  MY_TASK_BOARD_COLUMNS,
  type MyTaskStatus,
} from '@/lib/projects/tasks/my-tasks-constants'
import type { MyTasksReorderPayload } from '@/lib/projects/tasks/use-my-tasks-data'
import type { MyTasksInitialEntry } from './my-tasks-page'
import { DoneWindowFooter } from '@/app/(dashboard)/projects/_components/done-window-footer'
import type { TaskContextDetails } from '@/app/(dashboard)/projects/task-card'
import { shownIndexToBucketIndex } from '@/lib/dnd/shown-index'
import {
  BOARD_GRID_CLASS,
  boardGridStyle,
} from '@/components/board/board-column'
import { useKanbanDrag, type KanbanMove } from '@/lib/dnd/use-kanban-drag'
import { BoardBulkBar } from '@/components/board/board-bulk-bar'
import {
  BoardSelectionProvider,
  useBoardSelection,
} from '@/components/board/board-selection'
import { taskGroup, withoutHidden } from '@/lib/dnd/board-selection'

type TaskCardOptions = {
  context?: TaskContextDetails
}

type TaskLookupEntry = {
  task: TaskWithRelations
  /** Null for a lead task. */
  project: ProjectWithRelations | null
}

export type TaskLookup = Map<string, TaskLookupEntry>

type MyTasksBoardProps = {
  entries: MyTasksInitialEntry[]
  /**
   * Entries the search hides. They stay in `entries` so a drag keeps their
   * place: a card dropped between two shown cards lands between them.
   */
  hiddenTaskIds?: ReadonlySet<string>
  taskLookup: TaskLookup
  renderAssignees: RenderAssigneeFn
  getTaskCardOptions?: (task: TaskWithRelations) => TaskCardOptions | undefined
  onOpenTask: (taskId: string) => void
  onReorder: (update: MyTasksBoardReorderUpdate) => void
  activeTaskId: string | null
  scrollStorageKey?: string | null
  onCreateTask?: (status: MyTaskStatus) => void
  /** Current Done window width in weeks. */
  doneWeeks: number
  /** Assigned DONE tasks completed before the window. */
  olderDoneCount: number
  onLoadOlderDone: () => void
  isLoadingOlderDone: boolean
  doneWindowError: string | null
}

type TaskRow = {
  entry: MyTasksInitialEntry
  task: TaskWithRelations
  project: ProjectWithRelations | null
}

type TaskRowsByColumn = Map<MyTaskStatus, TaskRow[]>

export type MyTasksBoardReorderUpdate = {
  nextEntries: MyTasksInitialEntry[]
  previousEntries: MyTasksInitialEntry[]
  payload: MyTasksReorderPayload
}

export function MyTasksBoard({
  entries,
  hiddenTaskIds = NO_HIDDEN,
  taskLookup,
  renderAssignees,
  getTaskCardOptions,
  onOpenTask,
  onReorder,
  activeTaskId,
  scrollStorageKey,
  onCreateTask,
  doneWeeks,
  olderDoneCount,
  onLoadOlderDone,
  isLoadingOlderDone,
  doneWindowError,
}: MyTasksBoardProps) {
  const { sensors } = useProjectsBoardSensors()
  const { viewportRef: boardViewportRef, handleScroll: handleBoardScroll } =
    useScrollPersistence({
      storageKey: scrollStorageKey ?? null,
      axis: 'x',
    })
  const { getColumnRef, getScrollHandler } = useColumnScrollPersistence({
    storageKey: scrollStorageKey ?? 'my-tasks-board',
    columnIds: MY_TASK_BOARD_COLUMNS.map(col => col.id),
  })
  const [recentlyMovedTaskId, setRecentlyMovedTaskId] = useState<string | null>(
    null
  )

  const rowsByColumn = useMemo(
    () =>
      buildRowsByColumn(
        hiddenTaskIds.size
          ? entries.filter(entry => !hiddenTaskIds.has(entry.taskId))
          : entries,
        taskLookup
      ),
    [entries, hiddenTaskIds, taskLookup]
  )
  const selection = useBoardSelection(
    useMemo(
      () =>
        MY_TASK_COLUMN_IDS.map(status =>
          (rowsByColumn.get(status) ?? []).map(row => row.task.id)
        ),
      [rowsByColumn]
    ),
    true
  )
  const tasksIn = useCallback(
    (status: MyTaskStatus) =>
      withoutHidden(
        (rowsByColumn.get(status) ?? []).map(row => row.task),
        selection.hidden
      ),
    [rowsByColumn, selection.hidden]
  )

  const handleDrop = useCallback(
    ({ id: taskId, to, group }: KanbanMove<MyTaskStatus>) => {
      // Cards an archive is hiding count as filtered out, so a drop
      // lands between the cards it was dropped between.
      const hidden = selection.hidden.size
        ? new Set([...hiddenTaskIds, ...selection.hidden])
        : hiddenTaskIds
      const change = group
        ? produceGroupReorderUpdate({
            entries,
            hiddenTaskIds: hidden,
            statusOf: id => {
              const status = taskLookup.get(id)?.task.status
              return status ? normalizeStatus(status) : null
            },
            taskId,
            group,
            targetStatus: to.columnId,
            targetIndex: to.index,
          })
        : produceReorderUpdate({
            entries,
            hiddenTaskIds: hidden,
            taskLookup,
            taskId,
            targetStatus: to.columnId,
            targetIndex: to.index,
          })
      // The moved cards' columns, as the single move does.
      group?.forEach(id => {
        const meta = taskLookup.get(id)
        if (change && meta) meta.task.status = to.columnId
      })

      if (!change) {
        return
      }

      setRecentlyMovedTaskId(taskId)
      onReorder({
        nextEntries: change.nextEntries,
        previousEntries: entries,
        payload: change.payload,
      })
      setTimeout(() => setRecentlyMovedTaskId(null), 300)
    },
    [entries, hiddenTaskIds, onReorder, selection.hidden, taskLookup]
  )

  // Send to top / bottom of a selected card moves the column's selection.
  const sendTask = (move: KanbanMove<MyTaskStatus>) =>
    handleDrop({ ...move, group: selection.columnGroup(move.id) ?? undefined })
  const drag = useKanbanDrag({
    columns: MY_TASK_COLUMN_IDS,
    items: tasksIn,
    onDrop: handleDrop,
    groupOf: selection.dragGroup,
  })
  const draggingTask = drag.activeId
    ? (taskLookup.get(drag.activeId)?.task ?? null)
    : null

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='relative min-h-0 flex-1'>
        <div className='absolute inset-0 overflow-hidden'>
          <div
            ref={boardViewportRef}
            className='h-full min-h-0 overflow-x-auto'
            onScroll={handleBoardScroll}
          >
            <BoardSelectionProvider selection={selection}>
              <DndContext sensors={sensors} {...drag.dndContextProps}>
                <div
                  className={BOARD_GRID_CLASS}
                  style={boardGridStyle(MY_TASK_BOARD_COLUMNS.length)}
                >
                  {MY_TASK_BOARD_COLUMNS.map(column => {
                    const rows = rowsByColumn.get(column.id) ?? []
                    const handleCreateForColumn = onCreateTask
                      ? () => onCreateTask(column.id)
                      : undefined

                    return (
                      <KanbanColumn
                        key={column.id}
                        columnId={column.id}
                        label={column.label}
                        tasks={drag.itemsFor(column.id)}
                        canManage
                        onMoveTask={sendTask}
                        renderAssignees={renderAssignees}
                        onEditTask={task => onOpenTask(task.id)}
                        activeTaskId={activeTaskId}
                        onCreateTask={handleCreateForColumn}
                        enableCreateButton={Boolean(onCreateTask)}
                        isDropTarget={drag.activeColumnId === column.id}
                        recentlyMovedTaskId={recentlyMovedTaskId}
                        getTaskCardOptions={getTaskCardOptions}
                        columnScrollRef={getColumnRef(column.id)}
                        onColumnScroll={getScrollHandler(column.id)}
                        footerSlot={
                          // Nothing done and nothing hidden means there's no
                          // filtering to explain -- an empty column shouldn't
                          // carry a caption about tasks it never had.
                          column.id === 'DONE' &&
                          (rows.length > 0 || olderDoneCount > 0) ? (
                            <DoneWindowFooter
                              doneWeeks={doneWeeks}
                              hiddenCount={olderDoneCount}
                              onWiden={onLoadOlderDone}
                              isLoading={isLoadingOlderDone}
                              error={doneWindowError}
                            />
                          ) : undefined
                        }
                      />
                    )
                  })}
                </div>
                <TaskDragOverlay
                  draggingTask={draggingTask}
                  count={drag.activeCount}
                  renderAssignees={renderAssignees}
                  getTaskCardOptions={getTaskCardOptions}
                />
              </DndContext>
            </BoardSelectionProvider>
            <BoardBulkBar
              entity='task'
              selection={selection}
              nameOf={id => taskLookup.get(id)?.task.title}
              dueOnOf={id => taskLookup.get(id)?.task.due_on ?? null}
              groupOf={id => taskGroup(taskLookup.get(id)?.task)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function buildRowsByColumn(
  entries: MyTasksInitialEntry[],
  lookup: TaskLookup
): TaskRowsByColumn {
  const rows: TaskRowsByColumn = new Map()

  MY_TASK_BOARD_COLUMNS.forEach(column => {
    rows.set(column.id, [])
  })

  entries.forEach(entry => {
    const meta = lookup.get(entry.taskId)
    if (!meta) {
      return
    }

    const status = normalizeStatus(meta.task.status)
    const bucket = rows.get(status)

    if (!bucket) {
      return
    }

    bucket.push({
      entry,
      task: meta.task,
      project: meta.project,
    })
  })

  rows.forEach(bucket => {
    bucket.sort((a, b) => compareRows(a, b))
  })

  return rows
}

function compareRows(a: TaskRow, b: TaskRow): number {
  const orderA = a.entry.sortOrder ?? null
  const orderB = b.entry.sortOrder ?? null

  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB
  }

  if (orderA !== null && orderB === null) {
    return -1
  }

  if (orderA === null && orderB !== null) {
    return 1
  }

  const dueA = getTimestamp(a.task.due_on)
  const dueB = getTimestamp(b.task.due_on)

  if (dueA !== null && dueB !== null && dueA !== dueB) {
    return dueA - dueB
  }

  if (dueA !== null) {
    return -1
  }

  if (dueB !== null) {
    return 1
  }

  const updatedA = getTimestamp(a.task.updated_at)
  const updatedB = getTimestamp(b.task.updated_at)

  if (updatedA !== null && updatedB !== null && updatedA !== updatedB) {
    return updatedB - updatedA
  }

  return a.task.title.localeCompare(b.task.title)
}

const NO_HIDDEN: ReadonlySet<string> = new Set()
const MY_TASK_COLUMN_IDS = MY_TASK_BOARD_COLUMNS.map(column => column.id)

function produceReorderUpdate({
  entries,
  hiddenTaskIds,
  taskLookup,
  taskId,
  targetStatus,
  targetIndex,
}: {
  entries: MyTasksInitialEntry[]
  hiddenTaskIds: ReadonlySet<string>
  taskLookup: TaskLookup
  taskId: string
  targetStatus: MyTaskStatus
  targetIndex: number
}): {
  nextEntries: MyTasksInitialEntry[]
  payload: MyTasksReorderPayload
} | null {
  const meta = taskLookup.get(taskId)

  if (!meta) {
    return null
  }

  const sourceStatus = normalizeStatus(meta.task.status)
  const columnBuckets = new Map<MyTaskStatus, MyTasksInitialEntry[]>(
    MY_TASK_BOARD_COLUMNS.map(column => [column.id, []])
  )

  entries.forEach(entry => {
    const lookup = taskLookup.get(entry.taskId)
    if (!lookup) {
      return
    }

    const status = normalizeStatus(lookup.task.status)
    const bucket = columnBuckets.get(status)
    if (bucket) {
      bucket.push({ ...entry })
    }
  })

  const sourceBucket = columnBuckets.get(sourceStatus)
  const targetBucket = columnBuckets.get(targetStatus)

  if (!sourceBucket || !targetBucket) {
    return null
  }

  const sourceIndex = sourceBucket.findIndex(entry => entry.taskId === taskId)

  if (sourceIndex === -1) {
    return null
  }

  const [movedEntry] = sourceBucket.splice(sourceIndex, 1)
  targetBucket.splice(
    shownIndexToBucketIndex(targetBucket, hiddenTaskIds, targetIndex),
    0,
    movedEntry
  )

  if (sourceStatus !== targetStatus) {
    meta.task.status = targetStatus
  }

  applySortOrdering(targetBucket)

  if (sourceStatus !== targetStatus) {
    applySortOrdering(sourceBucket)
  }

  const nextEntries = Array.from(columnBuckets.values()).flat()
  const payload: MyTasksReorderPayload = {
    taskId,
    targetStatus,
    targetOrder: targetBucket.map(entry => entry.taskId),
  }

  if (sourceStatus !== targetStatus) {
    payload.sourceStatus = sourceStatus
    payload.sourceOrder = sourceBucket.map(entry => entry.taskId)
  }

  return { nextEntries, payload }
}

function applySortOrdering(bucket: MyTasksInitialEntry[]) {
  bucket.forEach((entry, index) => {
    entry.sortOrder = index + 1
  })
}

function normalizeStatus(status: string | null | undefined): MyTaskStatus {
  switch (status) {
    case 'ON_DECK':
    case 'IN_PROGRESS':
    case 'BLOCKED':
    case 'DONE':
      return status
    case 'IN_REVIEW':
      // IN_REVIEW status was removed; treat any legacy value as IN_PROGRESS
      return 'IN_PROGRESS'
    default:
      return 'ON_DECK'
  }
}

function getTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
