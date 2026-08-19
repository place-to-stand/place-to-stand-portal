import { withCliAuth } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeProject } from '@/lib/cli/serializers/project'
import { fetchProjectsLite } from '@/lib/data/projects'

export const GET = withCliAuth(async ({ request }) => {
  const query = cliListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  // `fetchProjectsLite` takes no user because it applies no per-user scoping —
  // admin access is already established by `withCliAuth`.
  const projects = await fetchProjectsLite()

  const search = query.search?.toLowerCase()
  const matched = search
    ? projects.filter(
        project =>
          project.name.toLowerCase().includes(search) ||
          project.slug?.toLowerCase().includes(search)
      )
    : projects

  return matched.slice(0, query.limit).map(serializeProject)
})
