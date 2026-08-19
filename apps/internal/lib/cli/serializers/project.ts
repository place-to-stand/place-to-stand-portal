import type { ProjectWithRelations } from '@/lib/types'

export type CliProject = {
  id: string
  name: string
  slug: string | null
  status: string
  type: ProjectWithRelations['type']
  clientId: string | null
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
    clientId: project.client_id,
    clientName: project.client?.name ?? null,
    clientSlug: project.client?.slug ?? null,
    ownerId: project.owner_id,
    startsOn: project.starts_on,
    endsOn: project.ends_on,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }
}
