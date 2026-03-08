import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, contactClients, leads, projects, messages, threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { classifyEmailThread } from '@/lib/ai/email-classification-matching'

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

    const body = await _req.json().catch(() => ({}))
    const force = body?.force === true

    // Return cached results if available (unless force re-analyze)
    if (thread.aiAnalyzedAt && !force) {
      return NextResponse.json({
        ok: true,
        cached: true,
        suggestions: thread.aiSuggestedClientId
          ? [{
              clientId: thread.aiSuggestedClientId,
              clientName: thread.aiSuggestedClientName,
              confidence: thread.aiConfidence ? parseFloat(thread.aiConfidence) : 0,
            }]
          : [],
        projectSuggestions: thread.aiSuggestedProjectId
          ? [{
              projectId: thread.aiSuggestedProjectId,
              projectName: thread.aiSuggestedProjectName,
              confidence: thread.aiConfidence ? parseFloat(thread.aiConfidence) : 0,
            }]
          : [],
        leadSuggestions: thread.aiSuggestedLeadId
          ? [{
              leadId: thread.aiSuggestedLeadId,
              leadName: thread.aiSuggestedLeadName,
              confidence: thread.aiConfidence ? parseFloat(thread.aiConfidence) : 0,
            }]
          : [],
      })
    }

    // If thread already has both client and project, return empty suggestions
    if (thread.clientId && thread.projectId) {
      return NextResponse.json({ ok: true, suggestions: [], projectSuggestions: [] })
    }

    // If thread is linked to an internal/personal project (no client), skip client suggestions
    let linkedProjectIsInternal = false
    if (thread.projectId && !thread.clientId) {
      const [linkedProject] = await db
        .select({ type: projects.type })
        .from(projects)
        .where(eq(projects.id, thread.projectId))
        .limit(1)
      if (linkedProject && (linkedProject.type === 'INTERNAL' || linkedProject.type === 'PERSONAL')) {
        linkedProjectIsInternal = true
      }
    }

    // Get the latest message in the thread for analysis
    const [latestMessage] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.sentAt))
      .limit(1)

    if (!latestMessage) {
      return NextResponse.json({ ok: true, suggestions: [], projectSuggestions: [] })
    }

    // Fetch all clients
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(isNull(clients.deletedAt))

    // Fetch contacts for each client via junction table
    const allContacts = await db
      .select({
        clientId: contactClients.clientId,
        email: contacts.email,
        name: contacts.name,
      })
      .from(contactClients)
      .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
      .where(isNull(contacts.deletedAt))

    // Fetch all active projects
    const allProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))

    // Build client name lookup
    const clientNameMap = new Map(allClients.map(c => [c.id, c.name]))

    // Group contacts and projects by client for client matching context
    const clientsWithData = allClients.map(client => ({
      id: client.id,
      name: client.name,
      contacts: allContacts
        .filter(c => c.clientId === client.id)
        .map(c => ({ email: c.email, name: c.name })),
      projects: allProjects
        .filter(p => p.clientId === client.id)
        .map(p => ({ name: p.name })),
    }))

    // Build projects list for project matching
    const projectsForMatching = allProjects.map(project => ({
      id: project.id,
      name: project.name,
      clientName: project.clientId ? clientNameMap.get(project.clientId) ?? null : null,
    }))

    // Fetch active leads for lead matching
    const allLeads = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        companyName: leads.companyName,
      })
      .from(leads)
      .where(isNull(leads.deletedAt))

    // Single AI call for client, project, and lead matching
    const { clientMatches, projectMatches, leadMatches } = await classifyEmailThread({
      email: {
        from: latestMessage.fromEmail,
        to: latestMessage.toEmails ?? [],
        cc: latestMessage.ccEmails ?? [],
        subject: latestMessage.subject ?? thread.subject,
        snippet: latestMessage.snippet,
      },
      clients: clientsWithData,
      projects: projectsForMatching,
      leads: allLeads,
    })

    // Transform to suggestion format (backward compatible)
    // Skip client suggestions if thread is already linked to an internal/personal project
    const suggestions = (thread.clientId || linkedProjectIsInternal)
      ? []
      : clientMatches.map(match => ({
          clientId: match.clientId,
          clientName: match.clientName,
          confidence: match.confidence,
          matchedContacts: [],
          reasoning: match.reasoning,
          matchType: match.matchType,
        }))

    const projectSuggestions = thread.projectId
      ? []
      : projectMatches.map(match => ({
          projectId: match.projectId,
          projectName: match.projectName,
          confidence: match.confidence,
          reasoning: match.reasoning,
          matchType: match.matchType,
        }))

    const leadSuggestionsList = thread.leadId
      ? []
      : leadMatches.map(match => ({
          leadId: match.leadId,
          leadName: match.leadName,
          confidence: match.confidence,
          reasoning: match.reasoning,
          matchType: match.matchType,
        }))

    // Cache top results in thread AI columns
    const topClient = suggestions[0]
    const topProject = projectSuggestions[0]
    const topLead = leadSuggestionsList[0]
    const topConfidence = Math.max(
      topClient?.confidence ?? 0,
      topProject?.confidence ?? 0,
      topLead?.confidence ?? 0,
    ) || null

    await db
      .update(threads)
      .set({
        aiSuggestedClientId: topClient?.clientId ?? null,
        aiSuggestedClientName: topClient?.clientName ?? null,
        aiSuggestedProjectId: topProject?.projectId ?? null,
        aiSuggestedProjectName: topProject?.projectName ?? null,
        aiSuggestedLeadId: topLead?.leadId ?? null,
        aiSuggestedLeadName: topLead?.leadName ?? null,
        aiConfidence: topConfidence?.toString() ?? null,
        aiAnalyzedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threads.id, threadId))

    return NextResponse.json({
      ok: true,
      cached: false,
      suggestions,
      projectSuggestions,
      leadSuggestions: leadSuggestionsList,
    })
  } catch (err) {
    const error = err as HttpError
    console.error('Thread suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
