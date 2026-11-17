import {
  useRef,
  type MutableRefObject,
  type ReactNode,
  type UIEventHandler,
} from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { Badge } from '@pts/ui/badge'
import { RowActionButton } from '@pts/ui/row-action-button'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import { useFlipOnMove } from '@/lib/dnd/use-flip-on-move'
import { columnEdgeMoves } from '@/lib/dnd/column-edge-moves'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import {
  getTaskStatusHue,
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'

import { TaskCard, type TaskContextDetails } from '../task-card'
import { boardColumnClass } from '@/components/board/board-column'
import { useBoardSelectionContext } from '@/components/board/board-selection'

type TaskCardOptions = {
  context?: TaskContextDetails
}

type KanbanColumnProps = {
  columnId: BoardColumnId
  label: string
  tasks: readonly TaskWithRelations[]
  canManage: boolean
  /**
   * Saves a move the way the board saves a drop. Adds Send to top and Send
   * to bottom to each card's right-click menu (with `canManage`).
   */
  onMoveTask?: (move: KanbanMove<BoardColumnId>) => void
  /** A card's Mark as done (task boards): null when it is done already. */
  markDoneFor?: (id: string) => (() => void) | null
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
  onMoveTask,
  markDoneFor,
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
  const columnRef = useRef<HTMLDivElement | null>(null)
  const selection = useBoardSelectionContext()
  // Send to top / bottom slides the cards, as a drag would show the move.
  const captureFlip = useFlipOnMove(columnRef, tasks)
  const moveTask = onMoveTask
    ? (move: KanbanMove<BoardColumnId>) => {
        captureFlip()
        onMoveTask(move)
      }
    : undefined
  const taskIds = tasks.map(task => task.id)
  const statusToken = getTaskStatusToken(columnId)
  const statusLabel = getTaskStatusLabel(columnId)
  const displayLabel = label || statusLabel

  const canShowCreateButton =
    typeof enableCreateButton === 'boolean' ? enableCreateButton : canManage

  return (
    <div
      ref={node => {
        setNodeRef(node)
        columnRef.current = node
      }}
      data-board-column={columnId}
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
      {/* No scroll anchoring: when a card sent to the top or bottom from its
          menu was the column's scroll anchor, the browser would scroll the
          column after it. */}
      <div
        ref={columnScrollRef}
        onScroll={onColumnScroll}
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [overflow-anchor:none]'
      >
        <SortableContext
          id={columnId}
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task, index) => (
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
              move={
                canManage && moveTask
                  ? columnEdgeMoves(
                      columnId,
                      taskIds,
                      index,
                      moveTask,
                      selection?.columnGroup(task.id) ?? null
                    )
                  : undefined
              }
              markDone={
                canManage && markDoneFor
                  ? () => markDoneFor(task.id)
                  : undefined
              }
            />
          ))}
        </SortableContext>
        {footerSlot}
      </div>
    </div>
  )
}
