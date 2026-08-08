import 'server-only'

import { cache } from 'react'
import { aliasedTable, and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  clientBillingTerms,
  contacts,
  projects,
  hourBlocks,
  timeLogs,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { createSearchPattern } from '@/lib/pagination/cursor'
import type { ProjectStatusValue } from '@/lib/constants'

export type ClientProjectSummary = {
  id: string
  name: string
  slug: string | null
  status: ProjectStatusValue
}

export type ClientWithMetrics = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  billingType: 'prepaid' | 'net_30'
  state: string | null
  originationContactId: string | null
  originationContactName: string | null
  originationUserId: string | null
  originationUserName: string | null
  originationUserAvatarUrl: string | null
  originationUserUpdatedAt: string | null
  closerUserId: string | null
  closerUserName: string | null
  closerUserAvatarUrl: string | null
  closerUserUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  projectCount: number
  activeProjectCount: number
  activeProjects: ClientProjectSummary[]
  allProjects: ClientProjectSummary[]
  totalHoursPurchased: number
  totalHoursUsed: number
  hoursRemaining: number
}

export type ClientDetail = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  state: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
  billingType: 'prepaid' | 'net_30'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export const fetchClientsWithMetrics = cache(
  async (user: AppUser, search?: string): Promise<ClientWithMetrics[]> => {
    assertAdmin(user)

    const baseConditions = [isNull(clients.deletedAt)]

    // PRD 004 §03: server-side `?q=` search on the clients landing table.
    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const pattern = createSearchPattern(trimmedSearch)
      baseConditions.push(sql`${clients.name} ILIKE ${pattern}`)
    }

    // Aliased user joins: the clients table references users three times
    // (createdBy, origination, closer) so we need distinct table aliases for
    // the two user joins we care about here.
    const originationUsers = aliasedTable(users, 'origination_users')
    const closerUsers = aliasedTable(users, 'closer_users')

    // Fetch base client data with project counts
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
        website: clients.website,
        billingType: clients.billingType,
        state: clients.state,
        originationContactId: clients.originationContactId,
        originationContactName: contacts.name,
        originationUserId: clients.originationUserId,
        originationUserName: originationUsers.fullName,
        originationUserEmail: originationUsers.email,
        originationUserAvatarUrl: originationUsers.avatarUrl,
        originationUserUpdatedAt: originationUsers.updatedAt,
        closerUserId: clients.closerUserId,
        closerUserName: closerUsers.fullName,
        closerUserEmail: closerUsers.email,
        closerUserAvatarUrl: closerUsers.avatarUrl,
        closerUserUpdatedAt: closerUsers.updatedAt,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        deletedAt: clients.deletedAt,
        projectCount: sql<number>`
          count(${projects.id}) filter (where ${projects.deletedAt} is null)
        `.as('project_count'),
        activeProjectCount: sql<number>`
          count(${projects.id}) filter (
            where ${projects.deletedAt} is null
            and lower(${projects.status}::text) in ('active', 'onboarding')
          )
        `.as('active_project_count'),
      })
      .from(clients)
      .leftJoin(projects, eq(projects.clientId, clients.id))
      .leftJoin(contacts, eq(clients.originationContactId, contacts.id))
      .leftJoin(
        originationUsers,
        eq(clients.originationUserId, originationUsers.id)
      )
      .leftJoin(closerUsers, eq(clients.closerUserId, closerUsers.id))
      .where(and(...baseConditions))
      .groupBy(
        clients.id,
        clients.name,
        clients.slug,
        clients.notes,
        clients.website,
        clients.billingType,
        clients.state,
        clients.originationContactId,
        contacts.name,
        clients.originationUserId,
        originationUsers.fullName,
        originationUsers.email,
        originationUsers.avatarUrl,
        originationUsers.updatedAt,
        clients.closerUserId,
        closerUsers.fullName,
        closerUsers.email,
        closerUsers.avatarUrl,
        closerUsers.updatedAt,
        clients.createdAt,
        clients.updatedAt,
        clients.deletedAt
      )
      .orderBy(asc(clients.name))

    if (rows.length === 0) {
      return []
    }

    const clientIds = rows.map(r => r.id)

    // Fetch hour blocks data separately
    const hourBlocksData = await db
      .select({
        clientId: hourBlocks.clientId,
        totalHoursPurchased: sql<number>`
          coalesce(sum(${hourBlocks.hoursPurchased}), 0)
        `.as('total_hours_purchased'),
      })
      .from(hourBlocks)
      .where(and(inArray(hourBlocks.clientId, clientIds), isNull(hourBlocks.deletedAt)))
      .groupBy(hourBlocks.clientId)

    const hourBlocksMap = new Map(
      hourBlocksData.map(hb => [hb.clientId, Number(hb.totalHoursPurchased ?? 0)])
    )

    // Fetch time logs data separately (only for active projects). The prepaid
    // burndown starts at the client's latest prepaid boundary
    // (client_billing_terms) — hours logged under an earlier net_30 era were
    // invoiced then and must not draw down purchased blocks. Always-prepaid
    // clients resolve their sentinel term (predates all data) and net_30-only
    // clients fall back to counting everything, so both are unchanged.
    const timeLogsData = await db
      .select({
        clientId: projects.clientId,
        totalHoursUsed: sql<number>`
          coalesce(sum(${timeLogs.hours}), 0)
        `.as('total_hours_used'),
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .where(
        and(
          inArray(projects.clientId, clientIds),
          isNull(timeLogs.deletedAt),
          isNull(projects.deletedAt),
          sql`${timeLogs.loggedOn} >= COALESCE((
            SELECT max(${clientBillingTerms.effectiveFrom})
            FROM ${clientBillingTerms}
            WHERE ${clientBillingTerms.clientId} = ${projects.clientId}
              AND ${clientBillingTerms.billingType} = 'prepaid'
              AND ${clientBillingTerms.deletedAt} IS NULL
          ), DATE '0001-01-01')`
        )
      )
      .groupBy(projects.clientId)

    const timeLogsMap = new Map(
      timeLogsData.map(tl => [tl.clientId, Number(tl.totalHoursUsed ?? 0)])
    )

    // Fetch every non-deleted project per client (any status). The active
    // list is derived below — the definition of "active" (ACTIVE/ONBOARDING)
    // is unchanged; "total" is any status, deletedAt IS NULL.
    const projectsData = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(
        and(inArray(projects.clientId, clientIds), isNull(projects.deletedAt))
      )
      .orderBy(asc(projects.name))

    // Group projects by client ID
    const projectsMap = new Map<string, ClientProjectSummary[]>()
    for (const project of projectsData) {
      if (!project.clientId) continue
      const existing = projectsMap.get(project.clientId) ?? []
      existing.push({
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: project.status,
      })
      projectsMap.set(project.clientId, existing)
    }

    return rows.map(row => {
      const totalHoursPurchased = hourBlocksMap.get(row.id) ?? 0
      const totalHoursUsed = timeLogsMap.get(row.id) ?? 0
      const hoursRemaining = totalHoursPurchased - totalHoursUsed
      const allProjects = projectsMap.get(row.id) ?? []
      const activeProjects = allProjects.filter(
        project => project.status === 'ACTIVE' || project.status === 'ONBOARDING'
      )

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        notes: row.notes,
        website: row.website,
        billingType: row.billingType,
        state: row.state,
        originationContactId: row.originationContactId,
        originationContactName: row.originationContactName,
        originationUserId: row.originationUserId,
        originationUserName:
          row.originationUserName ?? row.originationUserEmail ?? null,
        originationUserAvatarUrl: row.originationUserAvatarUrl ?? null,
        originationUserUpdatedAt: row.originationUserUpdatedAt ?? null,
        closerUserId: row.closerUserId,
        closerUserName: row.closerUserName ?? row.closerUserEmail ?? null,
        closerUserAvatarUrl: row.closerUserAvatarUrl ?? null,
        closerUserUpdatedAt: row.closerUserUpdatedAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        projectCount: Number(row.projectCount ?? 0),
        activeProjectCount: Number(row.activeProjectCount ?? 0),
        activeProjects,
        allProjects,
        totalHoursPurchased,
        totalHoursUsed,
        hoursRemaining,
      }
    })
  }
)

export const fetchClientById = cache(
  async (user: AppUser, clientId: string): Promise<ClientDetail> => {
    assertAdmin(user)

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
        website: clients.website,
        state: clients.state,
        originationContactId: clients.originationContactId,
        originationUserId: clients.originationUserId,
        closerUserId: clients.closerUserId,
        billingType: clients.billingType,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
      .limit(1)

    if (!rows.length) {
      throw new NotFoundError('Client not found')
    }

    return rows[0]
  }
)

export const fetchClientBySlug = cache(
  async (user: AppUser, slug: string): Promise<ClientDetail> => {
    const clientRow = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.slug, slug), isNull(clients.deletedAt)))
      .limit(1)

    if (!clientRow.length) {
      throw new NotFoundError('Client not found')
    }

    // Then check access and return full details
    return fetchClientById(user, clientRow[0].id)
  }
)

export type ClientProject = {
  id: string
  name: string
  slug: string | null
  status: string
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  startsOn: string | null
  endsOn: string | null
  totalTasks: number
  doneTasks: number
}

export const fetchProjectsForClient = cache(
  async (user: AppUser, clientId: string): Promise<ClientProject[]> => {
    assertAdmin(user)

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        type: projects.type,
        startsOn: projects.startsOn,
        endsOn: projects.endsOn,
      })
      .from(projects)
      .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name))

    // Fetch task counts for each project
    const projectIds = rows.map(r => r.id)

    if (projectIds.length === 0) {
      return []
    }

    const { tasks } = await import('@/lib/db/schema')

    const taskCounts = await db
      .select({
        projectId: tasks.projectId,
        total:
          sql<number>`count(*) filter (where ${tasks.status} != 'ARCHIVED')`.as(
            'total'
          ),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')`.as(
          'done'
        ),
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))
      .groupBy(tasks.projectId)

    const taskCountMap = new Map(
      taskCounts.map(tc => [tc.projectId, { total: tc.total, done: tc.done }])
    )

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      type: row.type,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      totalTasks: Number(taskCountMap.get(row.id)?.total ?? 0),
      doneTasks: Number(taskCountMap.get(row.id)?.done ?? 0),
    }))
  }
)

export async function fetchClientsByIds(
  clientIds: string[]
): Promise<ClientDetail[]> {
  if (!clientIds.length) {
    return []
  }

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
      notes: clients.notes,
      website: clients.website,
      state: clients.state,
      originationContactId: clients.originationContactId,
      originationUserId: clients.originationUserId,
      closerUserId: clients.closerUserId,
      billingType: clients.billingType,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt)))

  const lookup = new Map(rows.map(row => [row.id, row]))

  return clientIds
    .map(id => lookup.get(id))
    .filter((row): row is ClientDetail => Boolean(row))
}

/**
 * Resolves a client identifier (slug or UUID) to the client record.
 * Returns the client detail if found, throws NotFoundError otherwise.
 */
export const resolveClientIdentifier = cache(
  async (
    user: AppUser,
    identifier: string
  ): Promise<ClientDetail & { resolvedId: string }> => {
    // Check if identifier looks like a UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      )

    let client: ClientDetail

    if (isUUID) {
      client = await fetchClientById(user, identifier)
    } else {
      client = await fetchClientBySlug(user, identifier)
    }

    return { ...client, resolvedId: client.id }
  }
)
