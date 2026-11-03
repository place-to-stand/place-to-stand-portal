import 'server-only'

/** The summary's three counts: new leads, active projects, blocked tasks. */
import {
  and,
  countDistinct,
  count,
  eq,
  gte,
  isNotNull,
  isNull,
  notLike,
} from 'drizzle-orm'
import type { ActivityLogWithActor } from '@/lib/activity/types'
import { db } from '@/lib/db'
import { activityLogs, leads, tasks } from '@/lib/db/schema'
import { ActivityMetrics } from './config'

export async function computeMetrics(since: Date): Promise<ActivityMetrics> {
  const [newLeads, activeProjects, blockedTasks] = await Promise.all([
    countNewLeads(since),
    countActiveProjects(since),
    countBlockedTasks(),
  ])

  return {
    newLeads,
    activeProjects,
    blockedTasks,
  }
}

/**
 * Page views were logged as activity until Sep 2026; historical rows still
 * carry `*_VIEWED` verbs and must not count as project activity or feed the
 * prompt.
 */
export function isViewEvent(log: ActivityLogWithActor): boolean {
  return log.verb.endsWith('_VIEWED') && log.target_type !== 'INVOICE'
}

/**
 * Counted in the database rather than from the fetched sample so a busy
 * window that exceeds the fetch limit still reports every touched project.
 */
export async function countActiveProjects(since: Date): Promise<number> {
  const result = await db
    .select({ count: countDistinct(activityLogs.targetProjectId) })
    .from(activityLogs)
    .where(
      and(
        isNotNull(activityLogs.targetProjectId),
        gte(activityLogs.createdAt, since.toISOString()),
        notLike(activityLogs.verb, '%\\_VIEWED')
      )
    )

  return result[0]?.count ?? 0
}

export async function countNewLeads(since: Date): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(leads)
    .where(
      and(isNull(leads.deletedAt), gte(leads.createdAt, since.toISOString()))
    )

  return result[0]?.count ?? 0
}

export async function countBlockedTasks(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'BLOCKED')))

  return result[0]?.count ?? 0
}
