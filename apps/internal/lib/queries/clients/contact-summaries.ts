import { wasClientCompany } from '@pts/db/client-state'
import 'server-only'

import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, contacts, memberships } from '@/lib/db/schema'

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
  companyIds: string[]
): Promise<Map<string, ClientContactSummary[]>> {
  const result = new Map<string, ClientContactSummary[]>()
  if (companyIds.length === 0) {
    return result
  }

  const rows = await db
    .select({
      companyId: companies.id,
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      isPrimary: memberships.isPrimary,
    })
    .from(companies)
    .innerJoin(memberships, eq(memberships.companyId, companies.id))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        wasClientCompany(),
        and(
          inArray(companies.id, companyIds),
          isNull(memberships.endedAt),
          eq(memberships.portalAccess, true),
          // Access needs a portal login.
          isNotNull(contacts.userId),
          isNull(contacts.deletedAt)
        )
      )
    )
    .orderBy(
      desc(memberships.isPrimary),
      asc(contacts.name),
      asc(contacts.email)
    )

  for (const row of rows) {
    const existing = result.get(row.companyId) ?? []
    existing.push({
      id: row.id,
      name: row.name,
      email: row.email,
      isPrimary: row.isPrimary,
    })
    result.set(row.companyId, existing)
  }

  return result
}
