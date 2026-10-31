import type { ProjectWithRelations } from '@/lib/types'

import { isoTimestamp } from './timestamp'

export type CliProject = {
  id: string
  name: string
  slug: string | null
  status: string
  type: ProjectWithRelations['type']
  /** Since 0111 the client is its company: same value as companyId. */
  clientId: string | null
  companyId: string | null
  clientName: string | null
  clientSlug: string | null
  ownerId: string | null
  startsOn: string | null
  endsOn: string | null
  createdAt: string
  updatedAt: string
}

export function serializeProject(project: ProjectWithRelations): CliProject {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    type: project.type,
    clientId: project.company_id,
    companyId: project.company_id,
    clientName: project.client?.name ?? null,
    clientSlug: project.client?.slug ?? null,
    ownerId: project.owner_id,
    startsOn: project.starts_on,
    endsOn: project.ends_on,
    createdAt: isoTimestamp(project.created_at),
    updatedAt: isoTimestamp(project.updated_at),
  }
}
