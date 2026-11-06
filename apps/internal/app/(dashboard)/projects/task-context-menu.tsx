'use client'

import type { ReactElement } from 'react'

import { RecordContextMenu } from '@/components/table/record-context-menu'
import { useRecordArchive } from '@/components/table/use-record-archive'
import type { TaskWithRelations } from '@/lib/types'

import { removeTask } from './actions'

/**
 * Right-click on a task card: Edit, Duplicate, Archive. Archive confirms with
 * the same dialog as the task sheet's.
 */
export function TaskContextMenu({
  task,
  onEdit,
  draggable = false,
  children,
}: {
  task: TaskWithRelations
  onEdit: () => void
  draggable?: boolean
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
        onArchive={() => requestArchive({ id: task.id, name: task.title })}
        pending={isPending}
        draggable={draggable}
      >
        {children}
      </RecordContextMenu>
      {dialog}
    </>
  )
}
