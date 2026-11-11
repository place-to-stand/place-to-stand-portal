import { useCallback, type RefObject, type UIEventHandler } from 'react'
import type { ProjectIntegrationLinkSummary } from '@/lib/types/integrations'
import { DndContext, type DndContextProps } from '@dnd-kit/core'
import { useSearchParams } from 'next/navigation'

import { TabsContent } from '@pts/ui/tabs'
import {
  BOARD_GRID_CLASS,
  BOARD_PANEL_CLASS,
  boardGridStyle,
} from '@/components/board/board-column'
import { PagePanel } from '@/components/layout/page-panel'
import { DoneWindowFooter } from '../done-window-footer'
import { KanbanColumn } from '../kanban-column'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'
import { ProjectBoardFilters } from './project-board-filters'
import { useColumnScrollPersistence } from '@/hooks/use-column-scroll-persistence'
import { useKanbanDrag, type KanbanDrop } from '@/lib/dnd/use-kanban-drag'

import {
  FEEDBACK_CLASSES,
  NO_SELECTION_MESSAGE,
} from './projects-board-tabs.constants'
import {
  BOARD_COLUMNS,
  type BoardColumnId,
} from '@/lib/projects/board/board-constants'
import type { DbUser, TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

export type ProjectsBoardActiveProject = {
  id: string
  name: string
  slug: string | null
  status: string
  client: {
    id: string | null
    name: string | null
    slug: string | null
    billing_type: string | null
    /** The client's company: the Client link opens its sheet. */
    company_id?: string | null
  } | null
  owner: {
    id: string
    contact_id?: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  starts_on: string | null
  ends_on: string | null
  githubRepos: { id: string; repoFullName: string; defaultBranch: string }[]
  integrationLinks: ProjectIntegrationLinkSummary[]
  burndown: {
    totalClientRemainingHours: number
    totalProjectLoggedHours: number
  }
} | null

export type BoardTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  renderAssignees: RenderAssigneeFn
  canManageTasks: boolean
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: () => void
  onTaskDrop: (drop: KanbanDrop<BoardColumnId>) => void
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  activeSheetTaskId: string | null
  recentlyMovedTaskId: string | null
  /** Current Done window width in weeks. */
  doneWeeks: number
  /** DONE tasks completed before the window. */
  hiddenDoneCount: number
  /** Widens the window one step; instant, no fetch. */
  onWidenDoneWindow: () => void
  /** The people the board's person filter offers. */
  boardPeople: DbUser[]
  currentUserId: string
}

export function BoardTabContent(props: BoardTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    tasksByColumn,
    renderAssignees,
    canManageTasks,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onTaskDrop,
    boardViewportRef,
    onBoardScroll,
    activeSheetTaskId,
    recentlyMovedTaskId,
    doneWeeks,
    hiddenDoneCount,
    onWidenDoneWindow,
    boardPeople,
    currentUserId,
  } = props

  const searchParams = useSearchParams()
  const hasSearch = Boolean(
    searchParams.get('q')?.trim() || searchParams.get('assignee')
  )
  const { getColumnRef, getScrollHandler } = useColumnScrollPersistence({
    storageKey: 'projects-board',
    columnIds: BOARD_COLUMNS.map(col => col.id),
  })

  const tasksIn = useCallback(
    (columnId: BoardColumnId) => tasksByColumn.get(columnId) ?? NO_TASKS,
    [tasksByColumn]
  )
  const drag = useKanbanDrag({
    columns: BOARD_COLUMN_IDS,
    items: tasksIn,
    onDragStart,
    onDrop: onTaskDrop,
  })
  const draggingTask = drag.activeId
    ? (BOARD_COLUMN_IDS.flatMap(tasksIn).find(
        task => task.id === drag.activeId
      ) ?? null)
    : null

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='board'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      {!activeProject ? (
        <ProjectsBoardEmpty message={NO_SELECTION_MESSAGE} />
      ) : (
        // The same panel as a list: filter bar on top, the board below it.
        <PagePanel className={BOARD_PANEL_CLASS}>
          <ProjectBoardFilters
            people={boardPeople}
            currentUserId={currentUserId}
          />
          {hasSearch &&
          hiddenDoneCount === 0 &&
          BOARD_COLUMN_IDS.every(id => tasksIn(id).length === 0) ? (
            <ProjectsBoardEmpty message='No tasks match the current filters.' />
          ) : (
            <div className='relative min-h-0 flex-1'>
              <div className='absolute inset-0 overflow-hidden'>
                <div
                  ref={boardViewportRef}
                  className='h-full min-h-0 overflow-x-auto'
                  onScroll={onBoardScroll}
                >
                  <DndContext sensors={sensors} {...drag.dndContextProps}>
                    <div
                      className={BOARD_GRID_CLASS}
                      style={boardGridStyle(BOARD_COLUMNS.length)}
                    >
                      {BOARD_COLUMNS.map(column => {
                        const columnTasks = drag.itemsFor(column.id)

                        return (
                          <KanbanColumn
                            key={column.id}
                            columnId={column.id}
                            label={column.label}
                            tasks={columnTasks}
                            renderAssignees={renderAssignees}
                            onEditTask={onEditTask}
                            canManage={canManageTasks}
                            activeTaskId={activeSheetTaskId}
                            onCreateTask={onCreateTask}
                            isDropTarget={drag.activeColumnId === column.id}
                            recentlyMovedTaskId={recentlyMovedTaskId}
                            columnScrollRef={getColumnRef(column.id)}
                            onColumnScroll={getScrollHandler(column.id)}
                            footerSlot={
                              // Same rule as the My Tasks board: an empty column
                              // with nothing hidden has no filtering to explain.
                              column.id === 'DONE' &&
                              (columnTasks.length > 0 ||
                                hiddenDoneCount > 0) ? (
                                <DoneWindowFooter
                                  doneWeeks={doneWeeks}
                                  hiddenCount={hiddenDoneCount}
                                  onWiden={onWidenDoneWindow}
                                  isLoading={false}
                                  error={null}
                                />
                              ) : undefined
                            }
                          />
                        )
                      })}
                    </div>
                    <TaskDragOverlay
                      draggingTask={draggingTask}
                      renderAssignees={renderAssignees}
                    />
                  </DndContext>
                </div>
              </div>
            </div>
          )}
        </PagePanel>
      )}
    </TabsContent>
  )
}

const BOARD_COLUMN_IDS = BOARD_COLUMNS.map(column => column.id)
const NO_TASKS: TaskWithRelations[] = []
