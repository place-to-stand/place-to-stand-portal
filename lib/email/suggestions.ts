import 'server-only'

import { and, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, contactClients, clients, leads } from '@/lib/db/schema'

function normalize(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function domain(email: string) {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

export type ClientSuggestion = {
  clientId: string
  clientName: string
  confidence: 'HIGH' | 'MEDIUM'
}

/**
 * Suggest a client match based on participant emails (read-only, no DB writes).
 * Reuses the same contact + contactClients join logic as matchAndLinkThread.
 */
export async function suggestClientMatch(
  participantEmails: string[]
): Promise<ClientSuggestion | null> {
  const allAddresses = participantEmails.map(normalize).filter(Boolean)
  if (allAddresses.length === 0) return null

  const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

  const matchedContacts = await db
    .select({
      contactId: contacts.id,
      clientId: contactClients.clientId,
      clientName: clients.name,
      email: contacts.email,
    })
    .from(contacts)
    .innerJoin(contactClients, sql`${contactClients.contactId} = ${contacts.id}`)
    .innerJoin(clients, sql`${clients.id} = ${contactClients.clientId}`)
    .where(
      and(
        isNull(contacts.deletedAt),
        isNull(clients.deletedAt),
        sql`(lower(${contacts.email}) IN (${sql.join(allAddresses.map(e => sql`${e}`), sql`, `)}) OR split_part(lower(${contacts.email}), '@', 2) IN (${sql.join(addressDomains.map(d => sql`${d}`), sql`, `)}))`
      )
    )

  if (!matchedContacts.length) return null

  const bestMatch = matchedContacts[0]
  const isExactMatch = allAddresses.includes(normalize(bestMatch.email))

  return {
    clientId: bestMatch.clientId,
    clientName: bestMatch.clientName,
    confidence: isExactMatch ? 'HIGH' : 'MEDIUM',
  }
}

export type LeadSuggestion = {
  leadId: string
  contactName: string
  contactEmail: string
}

/**
 * Suggest a lead match based on participant emails (read-only, no DB writes).
 * Reuses the same lead email matching logic as matchThreadToLead.
 */
export async function suggestLeadMatch(
  participantEmails: string[]
): Promise<LeadSuggestion | null> {
  const normalizedEmails = participantEmails.map(normalize).filter(Boolean)
  if (!normalizedEmails.length) return null

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

  if (!lead || !lead.contactEmail) return null

  return {
    leadId: lead.id,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
  }
}
