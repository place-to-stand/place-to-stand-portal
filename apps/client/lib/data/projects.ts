import 'server-only'

import { cache } from 'react'
import { and, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, projects } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'

export type ClientProject = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
  clientName: string | null
}

export const fetchClientProjects = cache(
  async (user: AppUser): Promise<ClientProject[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const [projectRows, clientRows] = await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          slug: projects.slug,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(
          and(inArray(projects.clientId, clientIds), isNull(projects.deletedAt))
        ),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.id, clientIds)),
    ])

    const clientNameMap = new Map(clientRows.map(c => [c.id, c.name]))

    return projectRows.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      slug: p.slug,
      clientId: p.clientId,
      clientName: p.clientId ? (clientNameMap.get(p.clientId) ?? null) : null,
    }))
  }
)
