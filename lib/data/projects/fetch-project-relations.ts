import type { DbClient, GitHubRepoLinkSummary } from '@/lib/types'

import type {
  ClientMembership,
  MemberWithUser,
  RawHourBlock,
  RawTaskWithRelations,
} from './types'

import {
  loadClientRows,
  loadMemberRows,
  loadHourBlockRows,
  loadClientMembershipRows,
  mapClientRows,
  mapMemberRows,
  mapHourBlockRows,
  mapClientMembershipRows,
  type ClientRow,
  type MemberRow,
  type HourBlockRow,
  type ClientMembershipRow,
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
  shouldScopeToUser: boolean
  userId?: string
}

export type ProjectRelationsFetchResult = {
  clients: DbClient[]
  members: MemberWithUser[]
  tasks: RawTaskWithRelations[]
  archivedTasks: RawTaskWithRelations[]
  hourBlocks: RawHourBlock[]
  clientMemberships: ClientMembership[]
  githubReposByProject: Map<string, GitHubRepoLinkSummary[]>
}

export async function fetchProjectRelations({
  projectIds,
  clientIds,
  shouldScopeToUser,
  userId,
}: ProjectRelationsFetchArgs): Promise<ProjectRelationsFetchResult> {
  const clientDataPromise: Promise<[ClientRow[], MemberRow[], HourBlockRow[]]> =
    Promise.all([
      loadClientRows(clientIds),
      loadMemberRows(clientIds),
      loadHourBlockRows(clientIds),
    ])

  const taskDataPromise: Promise<[TaskRow[], TaskRow[]]> = Promise.all([
    loadTaskRows(projectIds, { archived: false }),
    loadTaskRows(projectIds, { archived: true }),
  ])

  const clientMembershipPromise: Promise<ClientMembershipRow[]> =
    shouldScopeToUser && userId
      ? loadClientMembershipRows(userId)
      : Promise.resolve([])

  const githubReposPromise = getReposForProjects(projectIds)

  const [
    [clientRows, memberRows, hourBlockRows],
    [activeTaskRows, archivedTaskRows],
    clientMembershipRows,
    githubReposMap,
  ] = await Promise.all([
    clientDataPromise,
    taskDataPromise,
    clientMembershipPromise,
    githubReposPromise,
  ])

  const allTaskIds = [...activeTaskRows, ...archivedTaskRows].map(row => row.id)
  const assigneeRows = await loadTaskAssigneeRows(allTaskIds)
  const assigneesByTask = buildAssigneeMap(assigneeRows)

  const clients: DbClient[] = mapClientRows(clientRows)
  const members: MemberWithUser[] = mapMemberRows(memberRows)
  const hourBlocks: RawHourBlock[] = mapHourBlockRows(hourBlockRows)
  const clientMemberships: ClientMembership[] =
    mapClientMembershipRows(clientMembershipRows)

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
    members,
    tasks,
    archivedTasks,
    hourBlocks,
    clientMemberships,
    githubReposByProject,
  }
}
