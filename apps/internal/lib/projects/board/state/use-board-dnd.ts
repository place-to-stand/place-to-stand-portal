import { useCallback } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'

import type { ProjectWithRelations } from '@/lib/types'

import { type BoardColumnId } from '../board-constants'
import {
  deriveReorderPlan,
  prepareReorderOutcome,
  type ColumnTaskFilter,
  type ReorderOutcome,
} from './dnd-helpers'
import { useGroupTaskMove } from './use-group-task-move'
import type { TaskLookup } from './types'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import { useRecentlyMovedItem } from '@/lib/dnd/use-recently-moved-item'

type UseBoardDnDArgs = {
  canManageTasks: boolean
  activeProject: ProjectWithRelations | null
  tasksByProject: TaskLookup
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
  startTransition: TransitionStartFunction
  setFeedback: Dispatch<SetStateAction<string | null>>
  /** Keeps rank math on the same task list the board renders per column. */
  filterColumnTasks?: ColumnTaskFilter
}

export const useBoardDnDState = ({
  canManageTasks,
  activeProject,
  tasksByProject,
  setTasksByProject,
  startTransition,
  setFeedback,
  filterColumnTasks,
}: UseBoardDnDArgs) => {
  const {
    recentlyMovedId: recentlyMovedTaskId,
    setRecentlyMovedId: setRecentlyMovedTaskId,
    scheduleReset: scheduleRecentlyMovedReset,
    clearTimer: clearRecentlyMovedTimer,
  } = useRecentlyMovedItem()

  const handleDragStart = useCallback(() => {
    setRecentlyMovedTaskId(null)
    clearRecentlyMovedTimer()
  }, [clearRecentlyMovedTimer, setRecentlyMovedTaskId])

  const markMoved = useCallback(
    (id: string) => {
      setRecentlyMovedTaskId(id)
      scheduleRecentlyMovedReset()
    },
    [scheduleRecentlyMovedReset, setRecentlyMovedTaskId]
  )
  const moveGroup = useGroupTaskMove({
    activeProject,
    tasksByProject,
    setTasksByProject,
    startTransition,
    setFeedback,
    filterColumnTasks,
    onMoved: markMoved,
  })

  const handleTaskDrop = useCallback(
    (drop: KanbanMove<BoardColumnId>) => {
      if (!canManageTasks || !activeProject) {
        return
      }

      if (drop.group) {
        moveGroup({ ...drop, group: drop.group })
        return
      }

      const plan = deriveReorderPlan(drop, tasksByProject, filterColumnTasks)

      if (!plan) {
        return
      }

      const { projectId, projectTasks, taskId } = plan

      let outcome: ReorderOutcome

      try {
        outcome = prepareReorderOutcome(plan)
      } catch (error) {
        console.error('Failed to compute rank for reordered task', error)
        setFeedback('Unable to reorder task.')
        scheduleRecentlyMovedReset()
        return
      }

      if (outcome.status === 'noop') {
        scheduleRecentlyMovedReset()
        return
      }

      const { destinationStatus, nextRank, recentlyMoved } = outcome

      // The card is already in its new slot; skip the layout animation.
      setRecentlyMovedTaskId(taskId)

      const rollbackTasks = projectTasks

      setFeedback(null)
      setTasksByProject(prev => {
        const next = new Map(prev)
        const tasks = next.get(projectId)

        if (!tasks) {
          return prev
        }

        const updated = tasks.map(task => {
          if (task.id !== taskId) {
            return task
          }

          return {
            ...task,
            status: destinationStatus,
            rank: nextRank,
          }
        })

        next.set(projectId, updated)
        return next
      })

      scheduleRecentlyMovedReset()

      const payload: { rank: string; status?: BoardColumnId } = {
        rank: nextRank,
      }

      if (recentlyMoved) {
        payload.status = destinationStatus
      }

      startTransition(async () => {
        try {
          const response = await fetch(`/api/v1/tasks/${taskId}/reorder`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
          }

          const json = await response.json().catch(() => null)
          const updatedRank = json?.task?.rank ?? nextRank
          const updatedStatus = json?.task?.status ?? destinationStatus
          const updatedAt = json?.task?.updated_at ?? null

          setTasksByProject(prev => {
            const next = new Map(prev)
            const tasks = next.get(projectId)

            if (!tasks) {
              return prev
            }

            const updated = tasks.map(task => {
              if (task.id !== taskId) {
                return task
              }

              return {
                ...task,
                status: updatedStatus,
                rank: updatedRank,
                updated_at: updatedAt ?? task.updated_at,
              }
            })

            next.set(projectId, updated)
            return next
          })
        } catch (error) {
          console.error('Task reorder failed', error)
          setFeedback('Unable to reorder task.')
          // Put back only this card, and only if nothing moved it since:
          // other moves made while it saved keep their place.
          const before = rollbackTasks.find(task => task.id === taskId)
          setTasksByProject(prev => {
            const tasks = prev.get(projectId)
            if (!tasks || !before) return prev
            const next = new Map(prev)
            next.set(
              projectId,
              tasks.map(task =>
                task.id === taskId &&
                task.status === destinationStatus &&
                task.rank === nextRank
                  ? before
                  : task
              )
            )
            return next
          })
        }
      })
    },
    [
      activeProject,
      canManageTasks,
      filterColumnTasks,
      moveGroup,
      setFeedback,
      setTasksByProject,
      scheduleRecentlyMovedReset,
      setRecentlyMovedTaskId,
      startTransition,
      tasksByProject,
    ]
  )

  return {
    handleDragStart,
    handleTaskDrop,
    recentlyMovedTaskId,
  }
}
