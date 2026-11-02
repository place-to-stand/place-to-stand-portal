import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { getProjectRepos, linkRepoToProject } from '@/lib/data/github-repos'
import { getActiveInstallationForProject } from '@/lib/github/app-installations'
import { resolveRepoForLink } from '@/lib/github/resolve-repo-link'

const linkSchema = z.object({
  repoFullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Invalid repo format (expected owner/repo)'),
  connectionId: z.string().uuid().optional(),
  githubAppInstallationId: z.string().uuid().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/api/projects/[projectId]/github-repos'>
) {
  await requireRole('ADMIN')
  const { projectId } = await params

  const repos = await getProjectRepos(projectId)

  return NextResponse.json({ repos })
}

/**
 * Links one repo now. The project sheet doesn't use this: it sends its repo
 * changes with the rest of the project in `saveProject`, in one transaction.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext<'/api/projects/[projectId]/github-repos'>
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  const body = await request.json()
  const result = linkSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid repo format', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const resolution = await resolveRepoForLink(user.id, result.data, () =>
    getActiveInstallationForProject(projectId)
  )

  if (!resolution.ok) {
    return NextResponse.json(
      {
        error: resolution.error,
        ...(resolution.code ? { code: resolution.code } : {}),
      },
      { status: resolution.status }
    )
  }

  try {
    const link = await linkRepoToProject(projectId, resolution.repo, user)
    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Error linking repo:', error)
    return NextResponse.json({ error: 'Failed to link repository' }, { status: 500 })
  }
}
