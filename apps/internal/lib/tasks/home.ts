import { eq } from 'drizzle-orm'

import { tasks } from '@/lib/db/schema'

/**
 * Where a task lives: a project or a lead, never both (`tasks_project_or_lead`
 * in the schema). Lead tasks have no project.
 */
export type TaskHome = { projectId: string | null; leadId: string | null }

/** The tasks sharing a home: the same project, or the same lead. */
export function sameTaskHome(home: TaskHome) {
  return home.projectId
    ? eq(tasks.projectId, home.projectId)
    : eq(tasks.leadId, home.leadId ?? '')
}

/**
 * Picking one clears the other: a lead wins over a project, so callers that
 * send both (an older client, the CLI) still land a valid task.
 */
export function resolveTaskHome(input: {
  projectId?: string | null
  leadId?: string | null
}): TaskHome | null {
  if (input.leadId) return { projectId: null, leadId: input.leadId }
  if (input.projectId) return { projectId: input.projectId, leadId: null }
  return null
}
