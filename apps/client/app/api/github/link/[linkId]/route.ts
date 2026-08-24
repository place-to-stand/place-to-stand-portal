import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubRepoLinks, projects } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccess } from '@/lib/auth/permissions'

/**
 * DELETE /api/github/link/:linkId
 *
 * Unlinks a repo from a project (soft delete).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { linkId } = await params

  const [link] = await db
    .select({
      id: githubRepoLinks.id,
      projectId: githubRepoLinks.projectId,
    })
    .from(githubRepoLinks)
    .where(and(eq(githubRepoLinks.id, linkId), isNull(githubRepoLinks.deletedAt)))
    .limit(1)

  if (!link) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const [project] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, link.projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project || !project.clientId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  await ensureClientAccess(user, project.clientId)

  await db
    .update(githubRepoLinks)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(githubRepoLinks.id, linkId))

  return NextResponse.json({ ok: true })
}
