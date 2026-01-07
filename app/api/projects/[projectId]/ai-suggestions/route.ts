import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, desc, inArray, sql } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projects, githubRepoLinks, suggestions, threads, messages } from '@/lib/db/schema'
import { createSuggestionsFromMessage } from '@/lib/ai/suggestion-service'

type FilterType = 'pending' | 'approved' | 'rejected'

/**
 * GET /api/projects/[projectId]/ai-suggestions
 *
 * Returns suggestions for the project with message context.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  // Get project to find the client
  const [project] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (!project.clientId) {
    return NextResponse.json({
      emails: [],
      meta: {
        totalEmails: 0,
        pendingSuggestions: 0,
        approvedSuggestions: 0,
        rejectedSuggestions: 0,
        unanalyzedEmails: 0,
        hasGitHubRepos: false,
        message: 'Project has no client. Link threads to a client first.',
      },
    })
  }

  // Get query params
  const filterParam = request.nextUrl.searchParams.get('filter') as FilterType | null
  const filter: FilterType = filterParam && ['pending', 'approved', 'rejected'].includes(filterParam)
    ? filterParam
    : 'pending'
  const countOnly = request.nextUrl.searchParams.get('countOnly') === 'true'

  // Helper to get status conditions based on filter
  const getStatusCondition = (f: FilterType) => {
    switch (f) {
      case 'pending':
        return inArray(suggestions.status, ['PENDING', 'DRAFT'])
      case 'approved':
        return inArray(suggestions.status, ['APPROVED', 'MODIFIED'])
      case 'rejected':
        return eq(suggestions.status, 'REJECTED')
    }
  }

  // For countOnly, just fetch the counts without full suggestion data
  if (countOnly) {
    const [suggestionCounts, gitHubRepos, unanalyzedMessages] = await Promise.all([
      db
        .select({
          status: suggestions.status,
          count: sql<number>`count(*)::int`,
        })
        .from(suggestions)
        .leftJoin(threads, eq(threads.id, suggestions.threadId))
        .where(
          and(
            eq(threads.clientId, project.clientId),
            isNull(suggestions.deletedAt)
          )
        )
        .groupBy(suggestions.status),
      db
        .select({ id: githubRepoLinks.id })
        .from(githubRepoLinks)
        .where(
          and(
            eq(githubRepoLinks.projectId, projectId),
            isNull(githubRepoLinks.deletedAt)
          )
        )
        .limit(1),
      db
        .select({ id: messages.id })
        .from(messages)
        .innerJoin(threads, eq(threads.id, messages.threadId))
        .where(
          and(
            eq(threads.clientId, project.clientId),
            eq(messages.userId, user.id),
            isNull(messages.deletedAt),
            isNull(messages.analyzedAt)
          )
        )
        .limit(100),
    ])

    // Calculate counts by status group
    let pendingCount = 0
    let approvedCount = 0
    let rejectedCount = 0
    for (const row of suggestionCounts) {
      if (row.status === 'PENDING' || row.status === 'DRAFT') {
        pendingCount += row.count
      } else if (row.status === 'APPROVED' || row.status === 'MODIFIED') {
        approvedCount += row.count
      } else if (row.status === 'REJECTED') {
        rejectedCount += row.count
      }
    }

    return NextResponse.json({
      emails: [],
      meta: {
        totalEmails: 0,
        pendingSuggestions: pendingCount,
        approvedSuggestions: approvedCount,
        rejectedSuggestions: rejectedCount,
        unanalyzedEmails: unanalyzedMessages.length,
        hasGitHubRepos: gitHubRepos.length > 0,
      },
    })
  }

  // Get suggestions for this project's client
  const suggestionQuery = db
    .select({
      suggestion: suggestions,
      message: messages,
      thread: threads,
    })
    .from(suggestions)
    .leftJoin(messages, eq(messages.id, suggestions.messageId))
    .leftJoin(threads, eq(threads.id, suggestions.threadId))
    .where(
      and(
        eq(threads.clientId, project.clientId),
        isNull(suggestions.deletedAt),
        getStatusCondition(filter)
      )
    )
    .orderBy(desc(suggestions.createdAt))
    .limit(100)

  const [suggestionRows, gitHubRepos, unanalyzedMessages, suggestionCounts] = await Promise.all([
    suggestionQuery,
    db
      .select({ id: githubRepoLinks.id })
      .from(githubRepoLinks)
      .where(
        and(
          eq(githubRepoLinks.projectId, projectId),
          isNull(githubRepoLinks.deletedAt)
        )
      )
      .limit(1),
    // Count unanalyzed messages for this client's threads (must belong to current user)
    db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(threads, eq(threads.id, messages.threadId))
      .where(
        and(
          eq(threads.clientId, project.clientId),
          eq(messages.userId, user.id),
          isNull(messages.deletedAt),
          isNull(messages.analyzedAt)
        )
      )
      .limit(100),
    // Get counts for all statuses
    db
      .select({
        status: suggestions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(suggestions)
      .leftJoin(threads, eq(threads.id, suggestions.threadId))
      .where(
        and(
          eq(threads.clientId, project.clientId),
          isNull(suggestions.deletedAt)
        )
      )
      .groupBy(suggestions.status),
  ])

  // Calculate counts by status group
  let pendingCount = 0
  let approvedCount = 0
  let rejectedCount = 0
  for (const row of suggestionCounts) {
    if (row.status === 'PENDING' || row.status === 'DRAFT') {
      pendingCount += row.count
    } else if (row.status === 'APPROVED' || row.status === 'MODIFIED') {
      approvedCount += row.count
    } else if (row.status === 'REJECTED') {
      rejectedCount += row.count
    }
  }

  // Group suggestions by message/email (format expected by the hook)
  const emailMap = new Map<string, {
    id: string
    threadId: string | null
    subject: string | null
    snippet: string | null
    fromEmail: string
    fromName: string | null
    receivedAt: string | null
    suggestions: Array<{
      id: string
      suggestedTitle: string
      suggestedDescription: string | null
      suggestedDueDate: string | null
      suggestedPriority: string | null
      confidence: string
      reasoning: string | null
      status: string
    }>
  }>()

  for (const row of suggestionRows) {
    if (!row.message) continue

    const messageId = row.message.id
    const content = row.suggestion.suggestedContent as {
      title?: string
      description?: string
      dueDate?: string
      priority?: string
    } | null

    const suggestion = {
      id: row.suggestion.id,
      suggestedTitle: content?.title || 'Untitled',
      suggestedDescription: content?.description || null,
      suggestedDueDate: content?.dueDate || null,
      suggestedPriority: content?.priority || null,
      confidence: row.suggestion.confidence,
      reasoning: row.suggestion.reasoning,
      status: row.suggestion.status,
    }

    if (emailMap.has(messageId)) {
      emailMap.get(messageId)!.suggestions.push(suggestion)
    } else {
      emailMap.set(messageId, {
        id: messageId,
        threadId: row.thread?.id ?? null,
        subject: row.message.subject,
        snippet: row.message.snippet,
        fromEmail: row.message.fromEmail,
        fromName: row.message.fromName,
        receivedAt: row.message.sentAt,
        suggestions: [suggestion],
      })
    }
  }

  const emails = Array.from(emailMap.values())

  return NextResponse.json({
    emails,
    meta: {
      totalEmails: emails.length,
      pendingSuggestions: pendingCount,
      approvedSuggestions: approvedCount,
      rejectedSuggestions: rejectedCount,
      unanalyzedEmails: unanalyzedMessages.length,
      hasGitHubRepos: gitHubRepos.length > 0,
    },
  })
}

/**
 * POST /api/projects/[projectId]/ai-suggestions
 *
 * Triggers AI analysis of unanalyzed messages linked to the project's client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  // Get project to find the client
  const [project] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (!project.clientId) {
    return NextResponse.json(
      { error: 'Project has no client' },
      { status: 400 }
    )
  }

  // Get unanalyzed message IDs from threads linked to this client (must belong to current user)
  const unanalyzedIds = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(
      and(
        eq(threads.clientId, project.clientId),
        eq(messages.userId, user.id),
        isNull(messages.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .limit(20)

  if (unanalyzedIds.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      created: 0,
      message: 'No unanalyzed messages found',
    })
  }

  // Analyze messages (limit to prevent timeout)
  const limit = Math.min(unanalyzedIds.length, 10)
  let analyzed = 0
  let created = 0
  let errors = 0

  for (let i = 0; i < limit; i++) {
    try {
      const result = await createSuggestionsFromMessage(unanalyzedIds[i].id, user.id)
      analyzed++
      created += result.created
    } catch (error) {
      console.error(`Failed to analyze message ${unanalyzedIds[i].id}:`, error)
      errors++
    }
  }

  return NextResponse.json({
    analyzed,
    created,
    errors,
    remaining: unanalyzedIds.length - limit,
  })
}
