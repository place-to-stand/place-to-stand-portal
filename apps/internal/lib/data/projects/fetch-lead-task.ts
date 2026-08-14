import 'server-only'

import type { TaskWithRelations } from '@/lib/types'

import { normalizeRawTask } from './normalize-task'
import {
  buildAssigneeMap,
  loadLeadTaskRow,
  loadTaskAssigneeRows,
  mapTaskRowsToRaw,
} from './relations/tasks'

/**
 * Hydrate a single lead-anchored task into the shape the task sheet consumes.
 *
 * Every other path to a `TaskWithRelations` goes through a project graph
 * (`fetchProjectsWithRelationsByIds`), which a lead task cannot use: it has no
 * project (PRD 005 D8). Without this, opening a lead task via `?task=<uuid>`
 * would throw NotFound — a regression, since before §04 every lead task carried
 * the Sales project and opened normally.
 *
 * Deliberately reuses the same relation loaders as the project path rather than
 * growing a second definition of "a task with its relations" (the §01 lesson).
 *
 * Returns null when the id is not a project-less task — including when it is an
 * ordinary project task, which the caller resolves through the project graph.
 */
export async function fetchLeadTaskWithRelations(
  taskId: string
): Promise<TaskWithRelations | null> {
  const row = await loadLeadTaskRow(taskId)

  if (!row) {
    return null
  }

  const assigneeRows = await loadTaskAssigneeRows([row.id])
  const [raw] = mapTaskRowsToRaw([row], buildAssigneeMap(assigneeRows))

  return raw ? normalizeRawTask(raw) : null
}
