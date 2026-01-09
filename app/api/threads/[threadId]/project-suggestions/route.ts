import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, messages, threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { matchEmailToProjects } from '@/lib/ai/email-project-matching'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await requireUser()
  const { threadId } = await params

  try {
    // Get the thread
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // If thread already has a project, return empty suggestions
    if (thread.projectId) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Get the latest message in the thread for analysis
    const [latestMessage] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.sentAt))
      .limit(1)

    if (!latestMessage) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Fetch all active projects with their client names
    // If thread has a linked client, prioritize their projects
    const allProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))

    if (allProjects.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Fetch all clients for name lookup
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(isNull(clients.deletedAt))

    // Create a client name lookup map
    const clientNameMap = new Map(allClients.map(c => [c.id, c.name]))

    // If thread has a linked client, prioritize their projects
    // by putting them first in the list
    let projectsForMatching = allProjects.map(project => ({
      id: project.id,
      name: project.name,
      clientName: project.clientId ? clientNameMap.get(project.clientId) ?? null : null,
    }))

    // Sort to prioritize projects from the linked client
    if (thread.clientId) {
      projectsForMatching = projectsForMatching.sort((a, b) => {
        const aIsLinkedClient = allProjects.find(p => p.id === a.id)?.clientId === thread.clientId
        const bIsLinkedClient = allProjects.find(p => p.id === b.id)?.clientId === thread.clientId
        if (aIsLinkedClient && !bIsLinkedClient) return -1
        if (!aIsLinkedClient && bIsLinkedClient) return 1
        return 0
      })
    }

    // Use AI to match thread to projects based on latest message
    const { matches } = await matchEmailToProjects({
      email: {
        from: latestMessage.fromEmail,
        to: latestMessage.toEmails ?? [],
        cc: latestMessage.ccEmails ?? [],
        subject: latestMessage.subject ?? thread.subject,
        snippet: latestMessage.snippet,
      },
      projects: projectsForMatching,
      linkedClientId: thread.clientId,
    })

    // Transform AI matches to suggestion format
    const suggestions = matches.map(match => ({
      projectId: match.projectId,
      projectName: match.projectName,
      confidence: match.confidence,
      reasoning: match.reasoning,
      matchType: match.matchType,
    }))

    return NextResponse.json({ ok: true, suggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Thread project suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
