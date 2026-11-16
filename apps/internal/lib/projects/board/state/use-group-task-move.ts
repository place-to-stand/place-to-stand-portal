import { useCallback } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'

import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import type { BoardColumnId } from '../board-constants'
import type { ColumnTaskFilter } from './dnd-helpers'
import { planGroupMove, type GroupTaskUpdate } from './group-move'
import type { TaskLookup } from './types'

/**
 * Moves several selected cards on the project board at once (a drag or
 * Send to top / bottom of a selected card): they show in place at once,
 * each saves through the one-card reorder endpoint, and all go back if one
 * save fails.
 */
export function useGroupTaskMove({
  activeProject,
  tasksByProject,
  setTasksByProject,
  startTransition,
  setFeedback,
  filterColumnTasks,
  onMoved,
}: {
  activeProject: ProjectWithRelations | null
  tasksByProject: TaskLookup
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
  startTransition: TransitionStartFunction
  setFeedback: Dispatch<SetStateAction<string | null>>
  filterColumnTasks?: ColumnTaskFilter
  /** The dragged card, for the board's just-moved styling. */
  onMoved: (id: string) => void
}) {
  return useCallback(
    (drop: KanbanMove<BoardColumnId> & { group: readonly string[] }) => {
      if (!activeProject) return
      const projectId = activeProject.id
      const projectTasks = tasksByProject.get(projectId)
      if (!projectTasks) return

      let updates: GroupTaskUpdate[] | null
      try {
        updates = planGroupMove(drop, projectTasks, filterColumnTasks)
      } catch (error) {
        console.error('Failed to compute ranks for moved tasks', error)
        setFeedback('Unable to move tasks.')
        return
      }
      if (!updates) return

      const byId = new Map(updates.map(update => [update.id, update]))
      const apply = (
        tasks: TaskWithRelations[],
        fields: (id: string) => Partial<TaskWithRelations> | null
      ) =>
        tasks.map(task => {
          const next = fields(task.id)
          return next ? { ...task, ...next } : task
        })
      const setProjectTasks = (
        fields: (id: string) => Partial<TaskWithRelations> | null
      ) =>
        setTasksByProject(prev => {
          const tasks = prev.get(projectId)
          if (!tasks) return prev
          return new Map(prev).set(projectId, apply(tasks, fields))
        })

      setFeedback(null)
      setProjectTasks(id => {
        const update = byId.get(id)
        return update ? { status: update.status, rank: update.rank } : null
      })
      onMoved(drop.id)

      startTransition(async () => {
        try {
          const saved = await Promise.all(
            updates.map(async update => {
              const response = await fetch(
                `/api/v1/tasks/${update.id}/reorder`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(
                    update.statusChanged
                      ? { rank: update.rank, status: update.status }
                      : { rank: update.rank }
                  ),
                }
              )
              if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`)
              }
              const json = await response.json().catch(() => null)
              return [update.id, json?.task ?? null] as const
            })
          )
          const fromServer = new Map(saved)
          setProjectTasks(id => {
            const task = fromServer.get(id)
            return task
              ? {
                  status: task.status,
                  rank: task.rank,
                  ...(task.updated_at ? { updated_at: task.updated_at } : {}),
                }
              : null
          })
        } catch (error) {
          console.error('Task group move failed', error)
          setFeedback('Unable to move tasks.')
          setTasksByProject(prev => new Map(prev).set(projectId, projectTasks))
        }
      })
    },
    [
      activeProject,
      filterColumnTasks,
      onMoved,
      setFeedback,
      setTasksByProject,
      startTransition,
      tasksByProject,
    ]
  )
}
