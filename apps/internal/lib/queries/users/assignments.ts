import 'server-only'

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  contacts,
  projects,
  taskAssignees,
} from '@/lib/db/schema'

export type UserAssignedClient = {
  id: string
  name: string
  slug: string | null
}

export type UserLinkedContact = {
  id: string
  name: string
  email: string
}

export type UserAssignmentSummary = {
  clients: number
  projects: number
  tasks: number
  clientList: UserAssignedClient[]
  /**
   * The live contact this user was promoted from (`contacts.user_id` is
   * unique, so at most one). Null for admins and for portal users created
   * straight from Settings → Users. Portal preview is keyed by contact.
   */
  contact: UserLinkedContact | null
}

export type UsersSettingsAssignments = Record<string, UserAssignmentSummary>

const emptySummary = (): UserAssignmentSummary => ({
  clients: 0,
  projects: 0,
  tasks: 0,
  clientList: [],
  contact: null,
})

/**
 * Per-user assignment summary for the settings users table and the archive
 * confirmation copy — four grouped queries regardless of page size.
 * Clients are live `client_members` rows on live clients; projects are live
 * projects the user owns (`projects.owner_id`); tasks are live
 * `task_assignees` rows. The client list backs the users-table hover card,
 * so its count is the list length; projects and tasks are plain counts for
 * the archive confirmation sentence. The linked contact backs the row's
 * portal preview action and the user sheet's link back to the contact.
 */
export async function buildAssignmentsForUsers(
  userIds: string[]
): Promise<UsersSettingsAssignments> {
  if (!userIds.length) {
    return {}
  }

  const [clientRows, projectCounts, taskCounts, contactRows] =
    await Promise.all([
      db
        .select({
          userId: clientMembers.userId,
          id: clients.id,
          name: clients.name,
          slug: clients.slug,
        })
        .from(clientMembers)
        .innerJoin(clients, eq(clientMembers.clientId, clients.id))
        .where(
          and(
            inArray(clientMembers.userId, userIds),
            isNull(clientMembers.deletedAt),
            isNull(clients.deletedAt)
          )
        )
        .orderBy(asc(clients.name)),
      db
        .select({
          userId: projects.ownerId,
          total: sql<number>`count(*)`,
        })
        .from(projects)
        .where(
          and(inArray(projects.ownerId, userIds), isNull(projects.deletedAt))
        )
        .groupBy(projects.ownerId),
      db
        .select({
          userId: taskAssignees.userId,
          total: sql<number>`count(distinct ${taskAssignees.id})`,
        })
        .from(taskAssignees)
        .where(
          and(
            inArray(taskAssignees.userId, userIds),
            isNull(taskAssignees.deletedAt)
          )
        )
        .groupBy(taskAssignees.userId),
      db
        .select({
          userId: contacts.userId,
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(inArray(contacts.userId, userIds), isNull(contacts.deletedAt))
        ),
    ])

  const assignments: UsersSettingsAssignments = {}
  const summaryFor = (userId: string) =>
    (assignments[userId] ??= emptySummary())

  for (const userId of userIds) {
    summaryFor(userId)
  }

  for (const row of clientRows) {
    const summary = summaryFor(row.userId)
    summary.clientList.push({ id: row.id, name: row.name, slug: row.slug })
    summary.clients = summary.clientList.length
  }

  for (const row of projectCounts) {
    if (!row.userId) continue
    summaryFor(row.userId).projects = Number(row.total ?? 0)
  }

  for (const row of taskCounts) {
    summaryFor(row.userId).tasks = Number(row.total ?? 0)
  }

  for (const row of contactRows) {
    const { userId, ...contact } = row
    if (!userId) continue
    summaryFor(userId).contact = contact
  }

  return assignments
}
