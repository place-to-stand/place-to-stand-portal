import { shownIndexToBucketIndex } from '@/lib/dnd/shown-index'
import type { MyTaskStatus } from '@/lib/projects/tasks/my-tasks-constants'
import type { MyTasksReorderPayload } from '@/lib/projects/tasks/use-my-tasks-data'

import type { MyTasksInitialEntry } from './my-tasks-page'

/**
 * Several selected cards dropped together on My Tasks: they leave their
 * columns and land as one block at `targetIndex` (counted on screen,
 * without them), in the group's order. Every column they touch is
 * renumbered and saved in one reorder request.
 */
export function produceGroupReorderUpdate({
  entries,
  hiddenTaskIds,
  statusOf,
  taskId,
  group,
  targetStatus,
  targetIndex,
}: {
  entries: MyTasksInitialEntry[]
  hiddenTaskIds: ReadonlySet<string>
  /** A card's column, or null when the board doesn't know it. */
  statusOf: (taskId: string) => MyTaskStatus | null
  /** The card that was dragged. */
  taskId: string
  group: readonly string[]
  targetStatus: MyTaskStatus
  targetIndex: number
}): {
  nextEntries: MyTasksInitialEntry[]
  payload: MyTasksReorderPayload
} | null {
  const moving = new Set(group)
  const buckets = new Map<MyTaskStatus, MyTasksInitialEntry[]>()
  const movedById = new Map<string, MyTasksInitialEntry>()
  const touched = new Set<MyTaskStatus>([targetStatus])

  for (const entry of entries) {
    const status = statusOf(entry.taskId)
    if (!status) continue
    if (moving.has(entry.taskId)) {
      movedById.set(entry.taskId, { ...entry })
      touched.add(status)
      continue
    }
    const bucket = buckets.get(status) ?? []
    bucket.push({ ...entry })
    buckets.set(status, bucket)
  }

  const moved = group.flatMap(id => {
    const entry = movedById.get(id)
    return entry ? [entry] : []
  })
  if (moved.length !== group.length) return null

  const target = buckets.get(targetStatus) ?? []
  target.splice(
    shownIndexToBucketIndex(target, hiddenTaskIds, targetIndex),
    0,
    ...moved
  )
  buckets.set(targetStatus, target)
  touched.forEach(status =>
    buckets.get(status)?.forEach((entry, index) => {
      entry.sortOrder = index + 1
    })
  )

  const orderOf = (status: MyTaskStatus) =>
    (buckets.get(status) ?? []).map(entry => entry.taskId)
  return {
    nextEntries: [...buckets.values()].flat(),
    payload: {
      taskId,
      targetStatus,
      targetOrder: orderOf(targetStatus),
      movedTaskIds: [...group],
      otherOrders: [...touched]
        .filter(status => status !== targetStatus)
        .map(status => ({ status, order: orderOf(status) })),
    },
  }
}
