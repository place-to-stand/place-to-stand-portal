import 'server-only'

import { and, arrayOverlaps, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  contactClients,
  contactLeads,
  contacts,
  leads,
  meetings,
  messages,
  proposals,
  projects,
  threads,
} from '@/lib/db/schema'
import { getLeadContactEmails } from '@/lib/matching/lead-matcher'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LeadContextThread = {
  id: string
  subject: string | null
  messageCount: number | null
  lastMessageAt: string | null
  messages: LeadContextMessage[]
}

export type LeadContextMessage = {
  id: string
  threadId: string
  fromEmail: string
  fromName: string | null
  sentAt: string
  isInbound: boolean
  snippet: string | null
  bodyPreview: string | null
}

export type LeadContextMeeting = {
  id: string
  title: string
  startsAt: string
  status: string
  transcriptText: string | null
}

export type ClientSummary = {
  id: string
  name: string
  slug: string | null
}

export type ProjectSummary = {
  id: string
  name: string
  clientId: string | null
  clientName: string | null
  status: string | null
}

export type ProposalSummary = {
  id: string
  title: string | null
  status: string | null
  createdAt: string
}

export type LeadContext = {
  lead: {
    id: string
    contactName: string
    contactEmail: string | null
    companyName: string | null
    companyWebsite: string | null
    notes: unknown
    status: string
  }
  contactEmails: string[]
  threads: LeadContextThread[]
  meetings: LeadContextMeeting[]
  relatedEntities: {
    existingClients: ClientSummary[]
    priorProposals: ProposalSummary[]
    convertedProjects: ProjectSummary[]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main context assembler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assemble full communication context for a lead.
 * Used by both suggestion generation and proposal drafting.
 */
export async function getLeadContext(leadId: string): Promise<LeadContext | null> {
  // 1. Fetch lead
  const [lead] = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      companyName: leads.companyName,
      companyWebsite: leads.companyWebsite,
      notes: leads.notes,
      status: leads.status,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) return null

  // 2. Get all associated emails
  const contactEmails = await getLeadContactEmails(leadId)

  // 3. Fetch threads (by leadId OR contact email overlap)
  const threadRows = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      messageCount: threads.messageCount,
      lastMessageAt: threads.lastMessageAt,
    })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        contactEmails.length > 0
          ? or(
              eq(threads.leadId, leadId),
              arrayOverlaps(threads.participantEmails, contactEmails)
            )
          : eq(threads.leadId, leadId)
      )
    )
    .orderBy(desc(threads.lastMessageAt))
    .limit(10)

  // 4. Fetch messages for threads
  const threadIds = threadRows.map(t => t.id)
  const threadMessages = threadIds.length > 0
    ? await db
        .select({
          id: messages.id,
          threadId: messages.threadId,
          fromEmail: messages.fromEmail,
          fromName: messages.fromName,
          sentAt: messages.sentAt,
          isInbound: messages.isInbound,
          snippet: messages.snippet,
          bodyText: messages.bodyText,
        })
        .from(messages)
        .where(
          and(
            inArray(messages.threadId, threadIds),
            isNull(messages.deletedAt)
          )
        )
        .orderBy(desc(messages.sentAt))
    : []

  // Group messages by thread
  const messagesByThread = new Map<string, typeof threadMessages>()
  for (const msg of threadMessages) {
    if (!messagesByThread.has(msg.threadId)) {
      messagesByThread.set(msg.threadId, [])
    }
    messagesByThread.get(msg.threadId)!.push(msg)
  }

  const contextThreads: LeadContextThread[] = threadRows.map(t => ({
    id: t.id,
    subject: t.subject,
    messageCount: t.messageCount,
    lastMessageAt: t.lastMessageAt,
    messages: (messagesByThread.get(t.id) || []).slice(0, 5).map(m => ({
      id: m.id,
      threadId: m.threadId,
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      sentAt: m.sentAt,
      isInbound: m.isInbound,
      snippet: m.snippet,
      bodyPreview: m.bodyText ? m.bodyText.slice(0, 1000) : null,
    })),
  }))

  // 5. Fetch meetings (by leadId OR attendee overlap)
  const contextMeetings = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      status: meetings.status,
      transcriptText: meetings.transcriptText,
    })
    .from(meetings)
    .where(
      and(
        isNull(meetings.deletedAt),
        isNotNull(meetings.transcriptText),
        contactEmails.length > 0
          ? or(
              eq(meetings.leadId, leadId),
              arrayOverlaps(meetings.attendeeEmails, contactEmails)
            )
          : eq(meetings.leadId, leadId)
      )
    )
    .orderBy(desc(meetings.startsAt))
    .limit(5)

  // 6. Fetch related clients (via contact_leads → contacts → contact_clients → clients)
  const existingClients = contactEmails.length > 0
    ? await db
        .selectDistinctOn([clients.id], {
          id: clients.id,
          name: clients.name,
          slug: clients.slug,
        })
        .from(contactLeads)
        .innerJoin(contacts, eq(contacts.id, contactLeads.contactId))
        .innerJoin(contactClients, eq(contactClients.contactId, contacts.id))
        .innerJoin(clients, eq(clients.id, contactClients.clientId))
        .where(
          and(
            eq(contactLeads.leadId, leadId),
            isNull(contacts.deletedAt),
            isNull(clients.deletedAt)
          )
        )
    : []

  // 7. Fetch prior proposals for this lead
  const priorProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.leadId, leadId),
        isNull(proposals.deletedAt)
      )
    )
    .orderBy(desc(proposals.createdAt))
    .limit(5)

  // 8. Fetch projects from related clients
  const clientIds = existingClients.map(c => c.id)
  const convertedProjects = clientIds.length > 0
    ? await db
        .select({
          id: projects.id,
          name: projects.name,
          clientId: projects.clientId,
          clientName: clients.name,
          status: projects.status,
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(
          and(
            inArray(projects.clientId, clientIds),
            isNull(projects.deletedAt)
          )
        )
        .orderBy(desc(projects.createdAt))
        .limit(10)
    : []

  return {
    lead,
    contactEmails,
    threads: contextThreads,
    meetings: contextMeetings,
    relatedEntities: {
      existingClients,
      priorProposals,
      convertedProjects,
    },
  }
}
