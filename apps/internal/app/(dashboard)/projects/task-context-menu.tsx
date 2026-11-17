'use client'

import type { ReactElement } from 'react'

import {
  RecordContextMenu,
  type CardEdgeMoves,
} from '@/components/table/record-context-menu'
import { useRecordArchive } from '@/components/table/use-record-archive'
import type { TaskWithRelations } from '@/lib/types'

import { changeTaskDueDate, removeTask, setTaskAssignee } from './actions'

/**
 * Right-click on a task card: Edit, Duplicate, Set assignee, Set due date,
 * Mark as done, Send to top / bottom (board cards), Archive.
 * Archive confirms with the same dialog as the task sheet's. A viewer who
 * can't manage tasks gets Edit only (it opens the sheet read-only).
 */
export function TaskContextMenu({
  task,
  onEdit,
  canManage,
  archivable = true,
  draggable = false,
  onChanged,
  move,
  markDone,
  children,
}: {
  task: TaskWithRelations
  onEdit: () => void
  canManage: boolean
  /** False where the list can't drop an archived card (the lead sheet). */
  archivable?: boolean
  draggable?: boolean
  /** Lists holding their own copy of the task (the lead sheet) refetch. */
  onChanged?: () => void
  /** Send to top / bottom; boards pass it, other lists don't. */
  move?: CardEdgeMoves
  /** Mark as done (task boards): the board's move to the top of Done. */
  markDone?: () => (() => void) | null
  children: ReactElement<Record<string, unknown>>
}) {
  const { requestArchive, isPending, dialog } = useRecordArchive({
    entity: 'task',
    noun: 'task',
    list: 'the project board',
    archive: async id => (await removeTask({ taskId: id })).error ?? null,
  })
  return (
    <>
      <RecordContextMenu
        entity='task'
        id={task.id}
        onEdit={onEdit}
        duplicable={canManage}
        assign={
          canManage
            ? {
                currentId: task.assignees[0]?.user_id ?? null,
                optionsUrl: `/api/tasks/${task.id}/assignee-options`,
                set: assigneeId =>
                  setTaskAssignee({ taskId: task.id, assigneeId }),
                name: task.title,
                onAssigned: onChanged,
              }
            : undefined
        }
        dueDate={
          canManage
            ? {
                current: task.due_on ?? null,
                set: dueOn => changeTaskDueDate({ taskId: task.id, dueOn }),
                name: task.title,
                onChanged,
              }
            : undefined
        }
        markDone={canManage ? markDone : undefined}
        move={canManage && move ? { ...move, name: task.title } : undefined}
        onArchive={
          canManage && archivable
            ? () => requestArchive({ id: task.id, name: task.title })
            : undefined
        }
        pending={isPending}
        draggable={draggable}
      >
        {children}
      </RecordContextMenu>
      {dialog}
    </>
  )
}
