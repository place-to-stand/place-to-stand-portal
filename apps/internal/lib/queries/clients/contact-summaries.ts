import 'server-only'

import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, contacts, memberships } from '@/lib/db/schema'

export type ClientContactSummary = {
  id: string
  name: string | null
  email: string | null
  /** The company's primary contact — addressed by default on invoice emails. */
  isPrimary: boolean
}

/**
 * Who has portal access to each client (company members with access),
 * keyed by client id — one grouped query for the clients landing's Portal
 * access column. `isPrimary` marks the company's primary contact.
 */
export async function fetchContactSummariesByClient(
  clientIds: string[]
): Promise<Map<string, ClientContactSummary[]>> {
  const result = new Map<string, ClientContactSummary[]>()
  if (clientIds.length === 0) {
    return result
  }

  const rows = await db
    .select({
      clientId: clients.id,
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      isPrimary: memberships.isPrimary,
    })
    .from(clients)
    .innerJoin(memberships, eq(memberships.companyId, clients.companyId))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        inArray(clients.id, clientIds),
        isNull(memberships.endedAt),
        eq(memberships.portalAccess, true),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(
      desc(memberships.isPrimary),
      asc(contacts.name),
      asc(contacts.email)
    )

  for (const row of rows) {
    const existing = result.get(row.clientId) ?? []
    existing.push({
      id: row.id,
      name: row.name,
      email: row.email,
      isPrimary: row.isPrimary,
    })
    result.set(row.clientId, existing)
  }

  return result
}
