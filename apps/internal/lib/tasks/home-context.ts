import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, projects } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { ensureTaskHomeAccess } from '@/lib/projects/access'

import type { TaskHome } from './home'

/**
 * Checks the actor may put a task in `home` and returns the company its
 * activity is filed under (the project's client, or the lead's company), or
 * the error a save shows.
 */
export async function resolveTaskHomeContext(
  actor: AppUser,
  home: TaskHome
): Promise<{ companyId: string | null } | { error: string }> {
  const noun = home.projectId ? 'project' : 'lead'

  try {
    await ensureTaskHomeAccess(actor, home)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: `Selected ${noun} is unavailable.` }
    }
    if (error instanceof ForbiddenError) {
      return {
        error: `You do not have permission to add tasks to this ${noun}.`,
      }
    }
    console.error('Failed to authorize task home access', error)
    return { error: `Unable to resolve the ${noun} for this task.` }
  }

  const [row] = home.projectId
    ? await db
        .select({ companyId: projects.companyId })
        .from(projects)
        .where(and(eq(projects.id, home.projectId), isNull(projects.deletedAt)))
        .limit(1)
    : await db
        .select({ companyId: leads.companyId })
        .from(leads)
        .where(and(eq(leads.id, home.leadId ?? ''), isNull(leads.deletedAt)))
        .limit(1)

  if (!row) {
    return { error: `Selected ${noun} is unavailable.` }
  }

  return { companyId: row.companyId ?? null }
}
