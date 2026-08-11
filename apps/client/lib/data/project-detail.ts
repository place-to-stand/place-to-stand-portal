import 'server-only'

import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'

export type ProjectDetail = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
}

/**
 * Load a project for the client portal.
 *
 * SECURITY: authorization lives here rather than in the calling page so a new
 * caller cannot forget it. Returns null instead of throwing on a denied project
 * so the caller's notFound() does not confirm that the id exists.
 */
export const fetchProjectDetail = cache(
  async (user: AppUser, projectId: string): Promise<ProjectDetail | null> => {
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        slug: projects.slug,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!project) return null

    // INTERNAL and PERSONAL projects carry no client_id. They are never surfaced
    // in the client portal, so refuse them outright — including for admins,
    // whose preview should show exactly what a client would see.
    if (!project.clientId) return null

    const { clientIds } = await resolvePortalScope(user)
    if (!clientIds.includes(project.clientId)) return null

    return project
  }
)
