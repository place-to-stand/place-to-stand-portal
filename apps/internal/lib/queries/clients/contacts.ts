import { wasClientCompany } from '@pts/db/client-state'
import 'server-only'

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, contacts, memberships } from '@/lib/db/schema'

export type ClientContactRow = {
  id: string
  email: string | null
  name: string
  phone: string | null
  createdBy: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  isPrimary: boolean
  /** Can see the client in the portal (a row in client_portal_access). */
  hasPortalAccess: boolean
}

/**
 * A client's people: everyone at its company (the old client links became
 * company memberships), primary first then by email. Shared by the client
 * detail page, invoice emails and the update composer so all agree on who
 * a client's people are. Portal access is separate.
 */
export async function fetchContactsForClient(
  companyId: string
): Promise<ClientContactRow[]> {
  return db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      createdBy: contacts.createdBy,
      userId: contacts.userId,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      deletedAt: contacts.deletedAt,
      isPrimary: memberships.isPrimary,
      // Read from the one source of portal access.
      hasPortalAccess: sql<boolean>`exists (
        select 1 from client_portal_access a
        where a.company_id = "companies"."id" and a.contact_id = "contacts"."id"
      )`,
    })
    .from(companies)
    .innerJoin(memberships, eq(memberships.companyId, companies.id))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        wasClientCompany(),
        and(
          eq(companies.id, companyId),
          isNull(memberships.endedAt),
          isNull(contacts.deletedAt)
        )
      )
    )
    .orderBy(desc(memberships.isPrimary), asc(contacts.email))
}
