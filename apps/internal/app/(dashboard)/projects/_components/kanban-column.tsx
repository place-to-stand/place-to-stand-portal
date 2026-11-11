import type { MutableRefObject, ReactNode, UIEventHandler } from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { Badge } from '@pts/ui/badge'
import { RowActionButton } from '@pts/ui/row-action-button'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import {
  getTaskStatusHue,
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'

import { TaskCard, type TaskContextDetails } from '../task-card'
import { boardColumnClass } from '@/components/board/board-column'

type TaskCardOptions = {
  context?: TaskContextDetails
}

type KanbanColumnProps = {
  columnId: BoardColumnId
  label: string
  tasks: readonly TaskWithRelations[]
  canManage: boolean
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string; avatarUrl: string | null }>
  onEditTask: (task: TaskWithRelations) => void
  activeTaskId: string | null
  onCreateTask?: (status: BoardColumnId) => void
  enableCreateButton?: boolean
  /** The dragged card is in this column now. */
  isDropTarget?: boolean
  recentlyMovedTaskId?: string | null
  getTaskCardOptions?: (task: TaskWithRelations) => TaskCardOptions | undefined
  columnScrollRef?: MutableRefObject<HTMLDivElement | null>
  onColumnScroll?: UIEventHandler<HTMLDivElement>
  /**
   * Rendered inside the scroll pane below the last card. Used by the My Tasks
   * Done column to offer widening its rolling window; unset everywhere else,
   * so the project board is unchanged.
   */
  footerSlot?: ReactNode
}

export function KanbanColumn({
  columnId,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
  onCreateTask,
  enableCreateButton,
  isDropTarget = false,
  recentlyMovedTaskId = null,
  getTaskCardOptions,
  columnScrollRef,
  onColumnScroll,
  footerSlot,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
  })
  const statusToken = getTaskStatusToken(columnId)
  const statusLabel = getTaskStatusLabel(columnId)
  const displayLabel = label || statusLabel

  const canShowCreateButton =
    typeof enableCreateButton === 'boolean' ? enableCreateButton : canManage

  return (
    <div
      ref={setNodeRef}
      className={boardColumnClass(getTaskStatusHue(columnId), isDropTarget)}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-3'>
          <Badge variant='outline' className={cn(statusToken)}>
            {displayLabel}
          </Badge>
          <span className='text-muted-foreground text-micro font-semibold tabular-nums'>
            {tasks.length}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {canShowCreateButton && onCreateTask ? (
            <RowActionButton
              type='button'
              label={`Create task to ${label}`}
              icon={<Plus />}
              onClick={() => onCreateTask(columnId as BoardColumnId)}
            />
          ) : null}
        </div>
      </div>
      <div
        ref={columnScrollRef}
        onScroll={onColumnScroll}
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'
      >
        <SortableContext
          id={columnId}
          items={tasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              assignees={renderAssignees(task)}
              onEdit={onEditTask}
              draggable={canManage}
              canManage={canManage}
              isActive={task.id === activeTaskId}
              disableDropTransition={task.id === recentlyMovedTaskId}
              context={getTaskCardOptions?.(task)?.context}
            />
          ))}
        </SortableContext>
        {footerSlot}
      </div>
    </div>
  )
}
