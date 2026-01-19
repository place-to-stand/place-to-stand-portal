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
import { CONVEX_FLAGS } from '@/lib/feature-flags'

// ============================================================
// CONVEX INTEGRATION (lazy loaded)
// ============================================================

async function getConvexTasks() {
  const convexModule = await import('@/lib/data/tasks/convex')
  return convexModule
}

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

  const clientMembershipPromise: Promise<ClientMembershipRow[]> =
    shouldScopeToUser && userId
      ? loadClientMembershipRows(userId)
      : Promise.resolve([])

  const githubReposPromise = getReposForProjects(projectIds)

  // Use Convex for tasks if enabled
  let tasks: RawTaskWithRelations[] = []
  let archivedTasks: RawTaskWithRelations[] = []

  if (CONVEX_FLAGS.TASKS && projectIds.length > 0) {
    try {
      const { fetchRawTasksFromConvex } = await getConvexTasks()

      // Fetch all tasks (including archived) for all projects in parallel
      const allTasksNested = await Promise.all(
        projectIds.map(pid => fetchRawTasksFromConvex(pid, { includeArchived: true }))
      )

      // Flatten and split by deleted_at status
      const allTasks = allTasksNested.flat()
      tasks = allTasks.filter(t => !t.deleted_at)
      archivedTasks = allTasks.filter(t => Boolean(t.deleted_at))
    } catch (error) {
      console.error('Failed to fetch tasks from Convex, falling back to Supabase:', error)
      // Fall through to Supabase
      tasks = []
      archivedTasks = []
    }
  }

  // If Convex wasn't used or failed, use Supabase
  const needsSupabaseTasks = tasks.length === 0 && archivedTasks.length === 0 && !CONVEX_FLAGS.TASKS

  const taskDataPromise: Promise<[TaskRow[], TaskRow[]]> = needsSupabaseTasks || !CONVEX_FLAGS.TASKS
    ? Promise.all([
        loadTaskRows(projectIds, { archived: false }),
        loadTaskRows(projectIds, { archived: true }),
      ])
    : Promise.resolve([[], []])

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

  const clients: DbClient[] = mapClientRows(clientRows)
  const members: MemberWithUser[] = mapMemberRows(memberRows)
  const hourBlocks: RawHourBlock[] = mapHourBlockRows(hourBlockRows)
  const clientMemberships: ClientMembership[] =
    mapClientMembershipRows(clientMembershipRows)

  // If we didn't get tasks from Convex, use Supabase results
  if (!CONVEX_FLAGS.TASKS || (tasks.length === 0 && archivedTasks.length === 0 && (activeTaskRows.length > 0 || archivedTaskRows.length > 0))) {
    const allTaskIds = [...activeTaskRows, ...archivedTaskRows].map(row => row.id)
    const assigneeRows = await loadTaskAssigneeRows(allTaskIds)
    const assigneesByTask = buildAssigneeMap(assigneeRows)

    tasks = mapTaskRowsToRaw(activeTaskRows, assigneesByTask)
    archivedTasks = mapTaskRowsToRaw(archivedTaskRows, assigneesByTask)
  }

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
