import 'server-only'

import { cache } from 'react'
import { and, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, projects, tasks } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { CURRENT_STATUSES } from '@/lib/data/tasks'

export type ClientProject = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
  clientName: string | null
  /** Queued or underway — the same set the project page lists as current. */
  openTaskCount: number
  /** Completed. Gives the dashboard progress bar its denominator. */
  doneTaskCount: number
}

export const fetchClientProjects = cache(
  async (user: AppUser): Promise<ClientProject[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const [projectRows, clientRows] = await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          slug: projects.slug,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(
          and(inArray(projects.clientId, clientIds), isNull(projects.deletedAt))
        ),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.id, clientIds)),
    ])

    const clientNameMap = new Map(clientRows.map(c => [c.id, c.name]))

    // One grouped count covering every project and both buckets. The dashboard
    // only shows how many tasks there are, never which ones, so no task rows
    // need to leave the database.
    const taskCounts = projectRows.length
      ? await db
          .select({
            projectId: tasks.projectId,
            status: tasks.status,
            count: sql<number>`count(*)::int`,
          })
          .from(tasks)
          .where(
            and(
              inArray(
                tasks.projectId,
                projectRows.map(p => p.id)
              ),
              isNull(tasks.deletedAt),
              inArray(tasks.status, [...CURRENT_STATUSES, 'DONE'])
            )
          )
          .groupBy(tasks.projectId, tasks.status)
      : []

    const countsByProject = new Map<string, { open: number; done: number }>()
    for (const row of taskCounts) {
      const entry = countsByProject.get(row.projectId) ?? { open: 0, done: 0 }
      if (row.status === 'DONE') entry.done += row.count
      else entry.open += row.count
      countsByProject.set(row.projectId, entry)
    }

    return projectRows.map(p => {
      const counts = countsByProject.get(p.id)
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        slug: p.slug,
        clientId: p.clientId,
        clientName: p.clientId ? (clientNameMap.get(p.clientId) ?? null) : null,
        openTaskCount: counts?.open ?? 0,
        doneTaskCount: counts?.done ?? 0,
      }
    })
  }
)
