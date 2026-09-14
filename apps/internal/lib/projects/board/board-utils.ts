import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import {
  BOARD_VIEW_SEGMENTS,
  type BoardColumnId,
  type BoardView,
} from './board-constants'

type ProjectsByClientMap = Map<string, ProjectWithRelations[]>
type ProjectLookupMap = Map<string, ProjectWithRelations>
type ClientSlugLookupMap = Map<string, string | null>

type BoardLookups = {
  projectLookup: ProjectLookupMap
  projectsByClientId: ProjectsByClientMap
  clientSlugLookup: ClientSlugLookupMap
}

export const PROJECT_SPECIAL_SEGMENTS = {
  INTERNAL: 'internal',
  PERSONAL: 'personal',
} as const

export const getProjectClientSegment = (
  project: ProjectWithRelations,
  clientSlugLookup?: ClientSlugLookupMap
) => {
  if (project.type === 'INTERNAL') {
    return PROJECT_SPECIAL_SEGMENTS.INTERNAL
  }

  if (project.type === 'PERSONAL') {
    return PROJECT_SPECIAL_SEGMENTS.PERSONAL
  }

  const clientId = project.client_id ?? null
  if (!clientId) {
    return null
  }

  if (project.client?.slug) {
    return project.client.slug
  }

  if (clientSlugLookup?.has(clientId)) {
    return clientSlugLookup.get(clientId) ?? null
  }

  return null
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Structural equality for the JSON-shaped data a task row carries: scalars,
 * ISO timestamp strings, and arrays of plain objects (assignees,
 * attachments). Nothing on `TaskWithRelations` is a Date or class instance,
 * so this is exhaustive for it. A key that is absent and a key set to
 * `undefined` are treated alike — `attachments` is optional and arrives both
 * ways depending on which query built the row.
 */
export const isStructurallyEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, index) => isStructurallyEqual(item, b[index]))
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) {
      if (!isStructurallyEqual(a[key], b[key])) {
        return false
      }
    }
    return true
  }

  return false
}

/**
 * Decides whether a fresh server task list should replace the board's local
 * copy (`useBoardTaskCollections`). Order-insensitive — columns re-sort by
 * rank — but otherwise every field counts.
 *
 * This used to fingerprint `status`/`rank`/`updated_at`/`commentCount` only,
 * and any change outside that list was silently dropped after
 * `router.refresh()`: logging time bumps `loggedHours` without touching
 * `updated_at`, so the card kept the old total until a hard reload. The
 * same hole covered every other aggregate or side-table field (attachments,
 * assignees, accepted_at, due_on written by the calendar route). Comparing
 * the whole row closes the class of bug instead of patching one field.
 */
export const areTaskCollectionsEqual = (
  a: TaskWithRelations[] | undefined,
  b: TaskWithRelations[]
) => {
  if (!a) return b.length === 0
  if (a.length !== b.length) return false

  const snapshot = new Map(a.map(task => [task.id, task]))

  return b.every(task => {
    const existing = snapshot.get(task.id)
    return existing !== undefined && isStructurallyEqual(existing, task)
  })
}

const fallbackTime = (value: string | null) =>
  value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY

export const compareTasksByRank = (
  a: TaskWithRelations,
  b: TaskWithRelations
) => {
  const aRank = a.rank ?? null
  const bRank = b.rank ?? null

  if (aRank && bRank && aRank !== bRank) {
    return aRank.localeCompare(bRank)
  }

  if (aRank && !bRank) {
    return -1
  }

  if (!aRank && bRank) {
    return 1
  }

  const createdAtDiff = fallbackTime(a.created_at) - fallbackTime(b.created_at)
  if (createdAtDiff !== 0) {
    return createdAtDiff
  }

  return a.id.localeCompare(b.id)
}

export const createProjectLookup = (
  projects: ProjectWithRelations[]
): ProjectLookupMap => {
  const map = new Map<string, ProjectWithRelations>()
  projects.forEach(project => {
    map.set(project.id, project)
  })
  return map
}

export const createProjectsByClientLookup = (
  projects: ProjectWithRelations[]
): ProjectsByClientMap => {
  const map = new Map<string, ProjectWithRelations[]>()
  projects.forEach(project => {
    if (!project.client_id) {
      return
    }
    const list = map.get(project.client_id) ?? []
    list.push(project)
    map.set(project.client_id, list)
  })
  return map
}

export const createClientSlugLookup = (
  clients: Array<{ id: string; slug: string | null }>
): ClientSlugLookupMap => {
  const map = new Map<string, string | null>()
  clients.forEach(client => {
    map.set(client.id, client.slug ?? null)
  })
  return map
}

export const buildBoardPath = (
  projectId: string,
  lookups: BoardLookups,
  options: {
    taskId?: string | null
    view?: BoardView
    /**
     * Current query string. Every other param is carried over so board
     * navigation doesn't silently drop a stacked sheet (`?client=…`) or a
     * filter — only `task` is rewritten.
     */
    search?: string
  } = {}
) => {
  const { taskId = null, view = 'board', search = '' } = options
  const project = lookups.projectLookup.get(projectId)

  if (!project) {
    return null
  }

  const projectSlug = project.slug ?? null
  const clientSegment = getProjectClientSegment(
    project,
    lookups.clientSlugLookup
  )

  if (!projectSlug || !clientSegment) {
    return null
  }

  const rootPath = `/projects/${clientSegment}/${projectSlug}`

  // Task selection travels as `?task=` (sheet deep-link convention): a query
  // change on the same route keeps the page mounted, unlike the old
  // trailing-segment URLs which remounted the whole board.
  const params = new URLSearchParams(search)
  if (taskId) {
    if (params.has('task')) {
      params.set('task', taskId)
    } else {
      // Append so a task opened over another sheet lands on top of the stack.
      params.append('task', taskId)
    }
  } else {
    params.delete('task')
  }
  const query = params.toString()
  const withQuery = (path: string) => (query ? `${path}?${query}` : path)

  if (view === 'activity') {
    return withQuery(`${rootPath}/${BOARD_VIEW_SEGMENTS.activity}`)
  }

  if (view === 'timeLogs') {
    return withQuery(`${rootPath}/${BOARD_VIEW_SEGMENTS.timeLogs}`)
  }

  if (view === 'review') {
    return withQuery(`${rootPath}/${BOARD_VIEW_SEGMENTS.review}`)
  }

  return withQuery(`${rootPath}/${BOARD_VIEW_SEGMENTS.board}`)
}

export const groupTasksByColumn = (
  tasks: TaskWithRelations[],
  columns: ReadonlyArray<{ id: BoardColumnId }>
) => {
  const map = new Map<BoardColumnId, TaskWithRelations[]>()
  const columnIds = new Set<BoardColumnId>()

  columns.forEach(column => {
    map.set(column.id, [])
    columnIds.add(column.id)
  })

  tasks
    .slice()
    .sort(compareTasksByRank)
    .forEach(task => {
      const status = task.status
      if (!columnIds.has(status as BoardColumnId)) {
        return
      }

      if (status === 'DONE' && task.accepted_at) {
        return
      }

      map.get(status as BoardColumnId)!.push(task)
    })

  return map
}
