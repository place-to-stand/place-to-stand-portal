import { DragOverlay } from '@dnd-kit/core'

import { BoardDragOverlay } from '@/components/board/board-drag'
import type { TaskWithRelations } from '@/lib/types'

import { TaskCardPreview, type TaskContextDetails } from '../task-card'
import { CalendarTaskCardPreview } from './projects-board/calendar-task-card-shell'

type TaskDragOverlayProps = {
  draggingTask: TaskWithRelations | null
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string; avatarUrl: string | null }>
  variant?: 'board' | 'calendar'
  /** Cards the drag moves (the board's selection), shown as a stack. */
  count?: number
  getTaskCardOptions?: (task: TaskWithRelations) =>
    | {
        context?: TaskContextDetails
      }
    | undefined
}

export function TaskDragOverlay({
  draggingTask,
  renderAssignees,
  variant = 'board',
  count = 1,
  getTaskCardOptions,
}: TaskDragOverlayProps) {
  const assignees = draggingTask ? renderAssignees(draggingTask) : []
  const options = draggingTask ? (getTaskCardOptions?.(draggingTask) ?? {}) : {}

  if (variant === 'calendar') {
    return (
      <DragOverlay dropAnimation={null}>
        {draggingTask ? (
          <CalendarTaskCardPreview task={draggingTask} assignees={assignees} />
        ) : null}
      </DragOverlay>
    )
  }

  return (
    <BoardDragOverlay count={count}>
      {draggingTask ? (
        <TaskCardPreview
          task={draggingTask}
          assignees={assignees}
          context={options.context}
        />
      ) : null}
    </BoardDragOverlay>
  )
}
