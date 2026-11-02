import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import type { ProjectWithRelations } from '@/lib/types'

import { listWorkableProjectIds } from './access'

const EMPTY_BURNDOWN: ProjectWithRelations['burndown'] = {
  totalClientPurchasedHours: 0,
  totalClientLoggedHours: 0,
  totalClientRemainingHours: 0,
  totalProjectLoggedHours: 0,
  projectMonthToDateLoggedHours: 0,
  lastLogAt: null,
}

/** Time logged on a task is admin-only, like every other hours figure. */
function redactTaskHours<T extends { loggedHours: number }>(tasks: T[]): T[] {
  return tasks.map(task => ({ ...task, loggedHours: 0 }))
}

/**
 * Strips what only admins should see from a project payload: hours and
 * billing, client notes and billing details, portal members, GitHub and
 * integration links. The task board still renders from what is left.
 */
export function redactProjectForMember<P extends ProjectWithRelations>(
  project: P
): P {
  return {
    ...project,
    client: project.client
      ? {
          ...project.client,
          notes: null,
          state: null,
          origination_contact_id: null,
          origination_user_id: null,
          closer_user_id: null,
          // Billing terms are admin-only. The board reads this field as
          // optional already, so null hides it rather than faking a value.
          billing_type: null as unknown as NonNullable<
            P['client']
          >['billing_type'],
        }
      : null,
    members: [],
    tasks: redactTaskHours(project.tasks),
    acceptedTasks: redactTaskHours(project.acceptedTasks),
    archivedTasks: redactTaskHours(project.archivedTasks),
    burndown: EMPTY_BURNDOWN,
    githubRepos: [],
    integrationLinks: [],
  }
}

/**
 * The projects this viewer may see, as the viewer may see them: everything
 * untouched for admins; for other staff only workable projects, redacted.
 */
export async function scopeProjectsForViewer<P extends ProjectWithRelations>(
  user: AppUser,
  projects: P[]
): Promise<P[]> {
  if (user.role === 'ADMIN') return projects

  const allowed = await listWorkableProjectIds(user)
  if (allowed === null) return projects

  const allowedIds = new Set(allowed)
  return projects
    .filter(project => allowedIds.has(project.id))
    .map(redactProjectForMember)
}
