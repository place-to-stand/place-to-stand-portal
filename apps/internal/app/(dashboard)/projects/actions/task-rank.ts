import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { getRankAfter, getRankBefore } from '@/lib/rank'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { TASK_STATUSES } from './shared-schemas'

type TaskStatus = (typeof TASK_STATUSES)[number]
type ColumnEdge = 'top' | 'bottom'

/**
 * Rank at one edge of the `status` column in `projectId`. Drag-and-drop
 * bypasses this and uses the dropped position directly.
 */
async function resolveColumnEdgeRank(
  projectId: string,
  status: TaskStatus,
  edge: ColumnEdge
) {
  const toTop = edge === 'top'

  const rows = await db
    .select({ rank: tasks.rank })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, status),
        isNull(tasks.deletedAt)
      )
    )
    .orderBy(toTop ? asc(tasks.rank) : desc(tasks.rank))
    .limit(1)

  const rank = rows[0]?.rank ?? null

  return toTop ? getRankBefore(rank) : getRankAfter(rank)
}

/**
 * Rank for a brand-new task. Open columns are queues, so a new arrival joins
 * the end. Done is a log read newest-first, so a task created straight into it
 * goes to the top instead.
 */
export function resolveNewTaskRank(projectId: string, status: TaskStatus) {
  return resolveColumnEdgeRank(projectId, status, status === 'DONE' ? 'top' : 'bottom')
}

/**
 * Rank for an existing task entering `status` (or a new project) without an
 * explicit drop position — a status change from the sheet, the CLI, or an
 * agent. The task that just moved is the one people open the column to find,
 * so it always goes to the top, whichever column it enters.
 */
export function resolveMovedTaskRank(projectId: string, status: TaskStatus) {
  return resolveColumnEdgeRank(projectId, status, 'top')
}
