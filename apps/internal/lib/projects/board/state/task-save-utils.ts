import type { Dispatch, SetStateAction } from 'react'

import type { TaskWithRelations } from '@/lib/types'

import type { TaskLookup } from './types'

/** Where a card sits on the board: its column and its rank in it. */
type TaskPlace = Pick<TaskWithRelations, 'status' | 'rank'>

export const placeOf = (task: TaskPlace): TaskPlace => ({
  status: task.status,
  rank: task.rank,
})

/** The board with `fields` applied to one card (same map if it's gone). */
function updateTask(
  lookup: TaskLookup,
  projectId: string,
  taskId: string,
  fields: Partial<TaskWithRelations>
): TaskLookup {
  const tasks = lookup.get(projectId)
  if (!tasks?.some(item => item.id === taskId)) return lookup
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
  const latest = new Map<string, number>()
  let moves = 0

  return (
    projectId: string,
    move: { id: string; before: TaskPlace; placed: TaskPlace },
    request: () => Promise<SavedTask | null>
  ): Promise<boolean> => {
    const { id, before, placed } = move
    const token = ++moves
    latest.set(id, token)
    if (!confirmed.has(id)) confirmed.set(id, before)
    const run = (queues.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(request)
    queues.set(id, run)

    // Only the card's newest move settles it: wherever the board shows it
    // now (a refresh may have put it back meanwhile), that save's answer is
    // where it really is.
    const settle = (fields: Partial<TaskWithRelations>) => {
      if (latest.get(id) !== token) return
      setTasksByProject(prev => updateTask(prev, projectId, id, fields))
    }
    const done = () => {
      // Nothing else queued for this card: forget its last saved place, so
      // a later move starts from the board (which a refresh updates).
      if (queues.get(id) === run) {
        queues.delete(id)
        confirmed.delete(id)
        latest.delete(id)
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
            : placed
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
