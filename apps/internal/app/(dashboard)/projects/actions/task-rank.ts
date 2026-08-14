import { and, desc, eq, isNull } from 'drizzle-orm'

import { getRankAfter } from '@/lib/rank'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { TASK_STATUSES } from './shared-schemas'

type TaskStatus = (typeof TASK_STATUSES)[number]

export async function resolveNextTaskRank(
  projectId: string,
  status: TaskStatus
) {
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
    .orderBy(desc(tasks.rank))
    .limit(1)

  const rank = rows[0]?.rank ?? null

  return getRankAfter(rank)
}

/**
 * Next rank for a LEAD-anchored task (PRD 005 D8).
 *
 * Ranks are unique within an anchor + status. For a project task the anchor is
 * the project; for a lead task it is the lead — a different scope, not the same
 * scope with a null argument (W6). Passing `null` into the project-scoped
 * helper above would compare `project_id = NULL`, which matches nothing, so
 * every lead task would be ranked as if it were the first.
 */
export async function resolveNextLeadTaskRank(
  leadId: string,
  status: TaskStatus
) {
  const rows = await db
    .select({ rank: tasks.rank })
    .from(tasks)
    .where(
      and(
        eq(tasks.leadId, leadId),
        isNull(tasks.projectId),
        eq(tasks.status, status),
        isNull(tasks.deletedAt)
      )
    )
    .orderBy(desc(tasks.rank))
    .limit(1)

  return getRankAfter(rows[0]?.rank ?? null)
}
