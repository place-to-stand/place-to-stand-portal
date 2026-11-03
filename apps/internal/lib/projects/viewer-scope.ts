import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import type { ClientCompanyView, ProjectWithRelations } from '@/lib/types'

import { listWorkableProjectIds } from './access'
import { roleCan } from '@/lib/auth/capabilities'

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
 * The client fields a project member may see. Every other key, including
 * ones added later, comes back null: an allowlist, so a new billing column
 * can't reach Sales by default.
 */
const MEMBER_CLIENT_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'slug',
  'company_id',
  'created_by',
  'created_at',
  'updated_at',
  'deleted_at',
])

function pickClientForMember<C extends ClientCompanyView>(client: C): C {
  return Object.fromEntries(
    Object.entries(client).map(([key, value]) => [
      key,
      MEMBER_CLIENT_FIELDS.has(key) ? value : null,
    ])
  ) as C
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
    client: project.client ? pickClientForMember(project.client) : null,
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
  let visible = projects
  if (!roleCan(user.role, 'projects.view_all')) {
    const allowed = await listWorkableProjectIds(user)
    if (allowed !== null) {
      const allowedIds = new Set(allowed)
      visible = projects.filter(project => allowedIds.has(project.id))
    }
  }

  return roleCan(user.role, 'projects.view_financials')
    ? visible
    : visible.map(redactProjectForMember)
}
