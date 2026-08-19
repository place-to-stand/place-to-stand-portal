import { withCliAuth } from '@/lib/cli/handler'
import { serializeProject } from '@/lib/cli/serializers/project'
import {
  fetchProjectsWithRelationsByIds,
  resolveProjectIdentifier,
} from '@/lib/data/projects'
import { NotFoundError } from '@/lib/errors/http'

type Params = { identifier: string }

/**
 * Accepts a UUID or a project slug. Hydrating through
 * `fetchProjectsWithRelationsByIds` after resolving keeps this response the
 * same shape as the list endpoint, rather than a second, thinner project type.
 */
export const GET = withCliAuth<Params>(async ({ user, params }) => {
  const resolved = await resolveProjectIdentifier(user, params.identifier)
  const [project] = await fetchProjectsWithRelationsByIds([resolved.resolvedId])

  if (!project) {
    throw new NotFoundError('Project not found.')
  }

  return serializeProject(project)
})
