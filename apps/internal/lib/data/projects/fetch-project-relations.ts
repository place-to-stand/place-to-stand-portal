import { and, inArray, isNull } from 'drizzle-orm'

import type { DbClient, GitHubRepoLinkSummary, ProjectOwner } from '@/lib/types'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

import type {
  MemberWithUser,
  RawHourBlock,
  RawTaskWithRelations,
} from './types'

import {
  loadClientRows,
  loadMemberRows,
  loadHourBlockRows,
  mapClientRows,
  mapMemberRows,
  mapHourBlockRows,
  type ClientRow,
  type MemberRow,
  type HourBlockRow,
} from './relations/clients'
import {
  buildAssigneeMap,
  loadTaskAssigneeRows,
  loadTaskRows,
  mapTaskRowsToRaw,
  type TaskRow,
} from './relations/tasks'
import { getReposForProjects } from '@/lib/data/github-repos'

export type ProjectRelationsFetchArgs = {
  projectIds: string[]
  clientIds: string[]
  ownerIds: string[]
  /**
   * Archived tasks grow without bound and only the project review/archive
   * tabs render them — every other surface skips the query entirely.
   */
  includeArchivedTasks?: boolean
}

export type ProjectRelationsFetchResult = {
  clients: DbClient[]
  owners: ProjectOwner[]
  members: MemberWithUser[]
  tasks: RawTaskWithRelations[]
  archivedTasks: RawTaskWithRelations[]
  hourBlocks: RawHourBlock[]
  githubReposByProject: Map<string, GitHubRepoLinkSummary[]>
}

export async function loadOwners(ownerIds: string[]): Promise<ProjectOwner[]> {
  if (ownerIds.length === 0) {
    return []
  }

  const rows = await db
    .select({
      id: users.id,
      full_name: users.fullName,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(and(inArray(users.id, ownerIds), isNull(users.deletedAt)))

  return rows.map(row => ({
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
  }))
}

export async function fetchProjectRelations({
  projectIds,
  clientIds,
  ownerIds,
  includeArchivedTasks = false,
}: ProjectRelationsFetchArgs): Promise<ProjectRelationsFetchResult> {
  const clientDataPromise: Promise<[ClientRow[], MemberRow[], HourBlockRow[]]> =
    Promise.all([
      loadClientRows(clientIds),
      loadMemberRows(clientIds),
      loadHourBlockRows(clientIds),
    ])

  const taskDataPromise: Promise<[TaskRow[], TaskRow[]]> = Promise.all([
    loadTaskRows(projectIds, { archived: false }),
    includeArchivedTasks
      ? loadTaskRows(projectIds, { archived: true })
      : Promise.resolve([]),
  ])

  const githubReposPromise = getReposForProjects(projectIds)
  const ownersPromise = loadOwners(ownerIds)

  const [
    [clientRows, memberRows, hourBlockRows],
    [activeTaskRows, archivedTaskRows],
    githubReposMap,
    owners,
  ] = await Promise.all([
    clientDataPromise,
    taskDataPromise,
    githubReposPromise,
    ownersPromise,
  ])

  const allTaskIds = [...activeTaskRows, ...archivedTaskRows].map(row => row.id)
  const assigneeRows = await loadTaskAssigneeRows(allTaskIds)
  const assigneesByTask = buildAssigneeMap(assigneeRows)

  const clients: DbClient[] = mapClientRows(clientRows)
  const members: MemberWithUser[] = mapMemberRows(memberRows)
  const hourBlocks: RawHourBlock[] = mapHourBlockRows(hourBlockRows)

  const tasks: RawTaskWithRelations[] = mapTaskRowsToRaw(
    activeTaskRows,
    assigneesByTask,
  )
  const archivedTasks: RawTaskWithRelations[] = mapTaskRowsToRaw(
    archivedTaskRows,
    assigneesByTask,
  )

  // Map GitHub repos to summary format
  const githubReposByProject = new Map<string, GitHubRepoLinkSummary[]>()
  githubReposMap.forEach((repos, projectId) => {
    githubReposByProject.set(
      projectId,
      repos.map(repo => ({
        id: repo.id,
        repoFullName: repo.repoFullName,
        defaultBranch: repo.defaultBranch,
      }))
    )
  })

  return {
    clients,
    owners,
    members,
    tasks,
    archivedTasks,
    hourBlocks,
    githubReposByProject,
  }
}
