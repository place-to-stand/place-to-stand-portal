import { useCallback } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'

import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import type { BoardColumnId } from '../board-constants'
import type { ColumnTaskFilter } from './dnd-helpers'
import { planGroupMove, type GroupTaskUpdate } from './group-move'
import type { TaskLookup } from './types'
import type { useTaskSaves } from './use-task-saves'

/**
 * Moves several selected cards on the project board at once (a drag or
 * Send to top / bottom of a selected card): they show in place at once,
 * each saves through the one-card reorder endpoint (`useTaskSaves`, so a
 * card moved again while this saves keeps its newer place), and any card a
 * save refuses goes back.
 */
export function useGroupTaskMove({
  saveTask,
  activeProject,
  tasksByProject,
  setTasksByProject,
  startTransition,
  setFeedback,
  filterColumnTasks,
  onMoved,
}: {
  saveTask: ReturnType<typeof useTaskSaves>
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
      if (!updates || leavesOrderAlone(updates, projectTasks)) return

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
        const before = new Map(projectTasks.map(task => [task.id, task]))
        const results = await Promise.all(
          updates.map(update => {
            const original = before.get(update.id)
            const placed = { status: update.status, rank: update.rank }
            return saveTask(
              projectId,
              {
                id: update.id,
                before: original
                  ? { status: original.status, rank: original.rank }
                  : placed,
                placed,
              },
              async () => {
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
                  throw new Error(
                    `Request failed with status ${response.status}`
                  )
                }
                const json = await response.json().catch(() => null)
                return json?.task ?? null
              }
            )
          })
        )
        const refused = results.filter(saved => !saved)
        if (refused.length) {
          setFeedback(
            refused.length === 1
              ? 'Unable to move one task.'
              : `Unable to move ${refused.length} tasks.`
          )
        }
      })
    },
    [
      saveTask,
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

/** True when the drop changes no column and no card's place in its column. */
function leavesOrderAlone(
  updates: readonly GroupTaskUpdate[],
  tasks: readonly TaskWithRelations[]
) {
  if (updates.some(update => update.statusChanged)) return false
  const byId = new Map(updates.map(update => [update.id, update]))
  const order = (rankOf: (task: TaskWithRelations) => string) =>
    tasks
      .filter(task => task.status === updates[0]!.status && !task.deleted_at)
      .map(task => ({ id: task.id, rank: rankOf(task) }))
      .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
      .map(task => task.id)
      .join()
  return (
    order(task => task.rank) ===
    order(task => byId.get(task.id)?.rank ?? task.rank)
  )
}
