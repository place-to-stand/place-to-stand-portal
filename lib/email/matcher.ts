import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, contactClients, leads, messages, threads } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { isAdmin } from '@/lib/auth/permissions'

function normalize(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function domain(email: string) {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

export type MatchResult = {
  linked: boolean
  clientId: string | null
  confidence: 'HIGH' | 'MEDIUM' | null
}

/**
 * Match a message against client contacts via exact email and domain heuristics.
 * Updates the thread's clientId directly in the new unified schema.
 */
export async function matchAndLinkMessage(
  user: AppUser,
  messageId: string
): Promise<MatchResult> {
  // Get the message and its thread
  const [row] = await db
    .select({
      message: messages,
      thread: threads,
    })
    .from(messages)
    .leftJoin(threads, eq(threads.id, messages.threadId))
    .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
    .limit(1)

  if (!row?.message) throw new NotFoundError('Message not found')

  const message = row.message
  const thread = row.thread

  if (!isAdmin(user) && message.userId !== user.id) {
    throw new ForbiddenError('Insufficient permissions to match message')
  }

  // If thread is already linked to a client, skip
  if (thread?.clientId) {
    return { linked: true, clientId: thread.clientId, confidence: 'HIGH' }
  }

  if (!thread) {
    return { linked: false, clientId: null, confidence: null }
  }

  const from = normalize(message.fromEmail)
  const tos = (message.toEmails ?? []).map(normalize)
  const ccs = (message.ccEmails ?? []).map(normalize)
  const allAddresses = Array.from(new Set([from, ...tos, ...ccs].filter(Boolean)))

  const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

  // Find contacts that match any address or any domain, joined with their client links
  const matchedContacts = await db
    .select({
      contactId: contacts.id,
      clientId: contactClients.clientId,
      email: contacts.email,
    })
    .from(contacts)
    .innerJoin(contactClients, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        isNull(contacts.deletedAt),
        // match exact emails OR any domain match
        sql`${contacts.email} = ANY(${allAddresses}) OR split_part(${contacts.email}, '@', 2) = ANY(${addressDomains})`
      )
    )

  if (!matchedContacts.length) {
    return { linked: false, clientId: null, confidence: null }
  }

  // Determine best match - prefer exact email match from sender
  const exactFromMatch = matchedContacts.find(c => normalize(c.email) === from)
  const anyExactMatch = matchedContacts.find(c => allAddresses.includes(normalize(c.email)))

  const bestMatch = exactFromMatch || anyExactMatch || matchedContacts[0]
  const confidence = exactFromMatch ? 'HIGH' : 'MEDIUM'

  // Update thread with client link
  await db
    .update(threads)
    .set({
      clientId: bestMatch.clientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, thread.id))

  return {
    linked: true,
    clientId: bestMatch.clientId,
    confidence,
  }
}

/**
 * Match all messages in a thread against client contacts.
 * Links the thread to the best matching client.
 */
export async function matchAndLinkThread(
  user: AppUser,
  threadId: string
): Promise<MatchResult> {
  // Get the thread
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1)

  if (!thread) throw new NotFoundError('Thread not found')

  // Check permissions - user must have created thread or be admin
  if (!isAdmin(user) && thread.createdBy !== user.id) {
    throw new ForbiddenError('Insufficient permissions to match thread')
  }

  // If thread is already linked to a client, return existing
  if (thread.clientId) {
    return { linked: true, clientId: thread.clientId, confidence: 'HIGH' }
  }

  // Use participant emails from thread
  const allAddresses = (thread.participantEmails ?? []).map(normalize).filter(Boolean)
  if (allAddresses.length === 0) {
    return { linked: false, clientId: null, confidence: null }
  }

  const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

  // Find contacts that match any address or any domain, joined with their client links
  const matchedContacts = await db
    .select({
      contactId: contacts.id,
      clientId: contactClients.clientId,
      email: contacts.email,
    })
    .from(contacts)
    .innerJoin(contactClients, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        isNull(contacts.deletedAt),
        sql`${contacts.email} = ANY(${allAddresses}) OR split_part(${contacts.email}, '@', 2) = ANY(${addressDomains})`
      )
    )

  if (!matchedContacts.length) {
    return { linked: false, clientId: null, confidence: null }
  }

  // Use the first matching client
  const bestMatch = matchedContacts[0]
  const isExactMatch = allAddresses.includes(normalize(bestMatch.email))
  const confidence = isExactMatch ? 'HIGH' : 'MEDIUM'

  // Update thread with client link
  await db
    .update(threads)
    .set({
      clientId: bestMatch.clientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, thread.id))

  return {
    linked: true,
    clientId: bestMatch.clientId,
    confidence,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead Matching
// ─────────────────────────────────────────────────────────────────────────────

export type LeadMatchResult = {
  leadId: string
  contactName: string
  contactEmail: string
  confidence: 'HIGH' | 'MEDIUM'
}

/**
 * Match a message sender to a lead by contact email.
 * Returns null if no matching lead found.
 */
export async function matchMessageToLead(
  fromEmail: string
): Promise<LeadMatchResult | null> {
  const normalizedEmail = normalize(fromEmail)
  if (!normalizedEmail) return null

  // Find lead with matching contact email
  const [lead] = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
    })
    .from(leads)
    .where(
      and(
        sql`lower(${leads.contactEmail}) = ${normalizedEmail}`,
        isNull(leads.deletedAt)
      )
    )
    .limit(1)

  if (!lead || !lead.contactEmail) {
    return null
  }

  return {
    leadId: lead.id,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    confidence: 'HIGH', // Exact email match
  }
}

/**
 * Match a thread to a lead by checking all participant emails.
 * Returns null if no matching lead found.
 */
export async function matchThreadToLead(
  participantEmails: string[]
): Promise<LeadMatchResult | null> {
  if (!participantEmails.length) return null

  const normalizedEmails = participantEmails.map(normalize).filter(Boolean)
  if (!normalizedEmails.length) return null

  // Find lead with any matching contact email
  // Use IN clause with properly joined parameters for PostgreSQL compatibility
  const [lead] = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
    })
    .from(leads)
    .where(
      and(
        sql`lower(${leads.contactEmail}) IN (${sql.join(normalizedEmails.map(e => sql`${e}`), sql`, `)})`,
        isNull(leads.deletedAt)
      )
    )
    .limit(1)

  if (!lead || !lead.contactEmail) {
    return null
  }

  return {
    leadId: lead.id,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    confidence: 'HIGH', // Exact email match
  }
}

/**
 * Update thread with lead link.
 */
export async function linkThreadToLead(
  threadId: string,
  leadId: string
): Promise<void> {
  await db
    .update(threads)
    .set({
      leadId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, threadId))
}
