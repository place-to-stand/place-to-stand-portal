import type { Dispatch, SetStateAction } from 'react'

import type { TaskWithRelations } from '@/lib/types'

import type { TaskLookup } from './types'

/** Where a card sits on the board: its column and its rank in it. */
export type TaskPlace = Pick<TaskWithRelations, 'status' | 'rank'>

export const placeOf = (task: TaskPlace): TaskPlace => ({
  status: task.status,
  rank: task.rank,
})

/**
 * The board with `fields` applied to one card, only while that card still
 * sits at `placed` (a newer move hasn't taken it elsewhere). Returns the
 * same map when nothing changes.
 */
export function updateIfStillPlaced(
  lookup: TaskLookup,
  projectId: string,
  taskId: string,
  placed: TaskPlace,
  fields: Partial<TaskWithRelations>
): TaskLookup {
  const tasks = lookup.get(projectId)
  const task = tasks?.find(item => item.id === taskId)
  if (
    !tasks ||
    !task ||
    task.status !== placed.status ||
    task.rank !== placed.rank
  ) {
    return lookup
  }
  return new Map(lookup).set(
    projectId,
    tasks.map(item => (item.id === taskId ? { ...item, ...fields } : item))
  )
}

type SavedTask = TaskPlace & { updated_at?: string | null }

/** `useTaskSaves`, outside React (see there). */
export function createTaskSaves(
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
) {
  const queues = new Map<string, Promise<unknown>>()
  const confirmed = new Map<string, TaskPlace>()

  return (
    projectId: string,
    move: { id: string; before: TaskPlace; placed: TaskPlace },
    request: () => Promise<SavedTask | null>
  ): Promise<boolean> => {
    const { id, before, placed } = move
    if (!confirmed.has(id)) confirmed.set(id, before)
    const run = (queues.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(request)
    queues.set(id, run)

    const settle = (fields: Partial<TaskWithRelations>) =>
      setTasksByProject(prev =>
        updateIfStillPlaced(prev, projectId, id, placed, fields)
      )
    const done = () => {
      // Nothing else queued for this card: forget its last saved place, so
      // a later move starts from the board (which a refresh updates).
      if (queues.get(id) === run) {
        queues.delete(id)
        confirmed.delete(id)
      }
    }

    return run.then(
      saved => {
        confirmed.set(id, saved ? placeOf(saved) : placed)
        settle(
          saved
            ? {
                ...placeOf(saved),
                ...(saved.updated_at ? { updated_at: saved.updated_at } : {}),
              }
            : {}
        )
        done()
        return true
      },
      error => {
        console.error('Task reorder failed', error)
        settle(confirmed.get(id) ?? before)
        done()
        return false
      }
    )
  }
}
