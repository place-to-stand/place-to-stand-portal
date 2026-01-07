import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, desc, inArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { suggestions, threads, projects, clients } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError, toResponsePayload, type HttpError } from '@/lib/errors/http'

type RouteParams = {
  params: Promise<{ threadId: string }>
}

/**
 * GET /api/threads/[threadId]/ai-suggestions
 * Get pending AI-generated suggestions (tasks, PRs) for a thread
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser()
  const { threadId } = await params

  try {
    // Verify thread exists and user has access
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // Get all suggestions for this thread (not filtered by status)
    const rows = await db
      .select({
        id: suggestions.id,
        type: suggestions.type,
        status: suggestions.status,
        confidence: suggestions.confidence,
        suggestedContent: suggestions.suggestedContent,
        createdAt: suggestions.createdAt,
        projectId: suggestions.projectId,
      })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.threadId, threadId),
          isNull(suggestions.deletedAt)
        )
      )
      .orderBy(desc(suggestions.confidence))

    // Get project info including slugs for navigation
    const projectIds = [...new Set(rows.map(s => s.projectId).filter(Boolean))] as string[]
    const projectRows = projectIds.length > 0
      ? await db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientId: projects.clientId,
          })
          .from(projects)
          .where(and(
            isNull(projects.deletedAt),
            inArray(projects.id, projectIds)
          ))
      : []

    // Get client slugs for projects that have clients
    const clientIds = [...new Set(projectRows.map(p => p.clientId).filter(Boolean))] as string[]
    const clientRows = clientIds.length > 0
      ? await db
          .select({ id: clients.id, slug: clients.slug })
          .from(clients)
          .where(and(
            isNull(clients.deletedAt),
            inArray(clients.id, clientIds)
          ))
      : []
    const clientMap = new Map(clientRows.map(c => [c.id, c.slug]))

    const projectMap = new Map(projectRows.map(p => [
      p.id,
      {
        name: p.name,
        slug: p.slug,
        clientSlug: p.clientId ? clientMap.get(p.clientId) ?? null : null,
      },
    ]))

    const formattedSuggestions = rows.map(s => {
      const content = s.suggestedContent as Record<string, unknown>
      const projectInfo = s.projectId ? projectMap.get(s.projectId) : null
      return {
        id: s.id,
        type: s.type,
        status: s.status,
        confidence: s.confidence,
        title: typeof content.title === 'string' ? content.title : undefined,
        createdAt: s.createdAt,
        projectName: projectInfo?.name ?? null,
        projectSlug: projectInfo?.slug ?? null,
        clientSlug: projectInfo?.clientSlug ?? null,
      }
    })

    return NextResponse.json({ ok: true, suggestions: formattedSuggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Thread AI suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
