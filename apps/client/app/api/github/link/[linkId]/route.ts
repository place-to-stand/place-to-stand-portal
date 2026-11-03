import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { githubRepoLinks, projects } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { clientAccessDenied } from '@/lib/auth/permissions'

/**
 * DELETE /api/github/link/:linkId
 *
 * Unlinks a repo from a project (soft delete).
 */
export async function DELETE(
  request: Request,
  { params }: RouteContext<'/api/github/link/[linkId]'>
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { linkId } = await params
  if (!z.uuid().safeParse(linkId).success) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const [link] = await db
    .select({
      id: githubRepoLinks.id,
      projectId: githubRepoLinks.projectId,
    })
    .from(githubRepoLinks)
    .where(
      and(eq(githubRepoLinks.id, linkId), isNull(githubRepoLinks.deletedAt))
    )
    .limit(1)

  if (!link) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const [project] = await db
    .select({ id: projects.id, companyId: projects.companyId })
    .from(projects)
    .where(and(eq(projects.id, link.projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project || !project.companyId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const denied = await clientAccessDenied(user, project.companyId)
  if (denied) return denied

  await db
    .update(githubRepoLinks)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(githubRepoLinks.id, linkId))

  return NextResponse.json({ ok: true })
}
