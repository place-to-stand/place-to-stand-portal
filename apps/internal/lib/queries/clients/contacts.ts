import 'server-only'

import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, contacts, memberships } from '@/lib/db/schema'

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
}

/**
 * A client's people: everyone at its company (the old client links became
 * company memberships), primary first then by email. Shared by the client
 * detail page, invoice emails and the update composer so all agree on who
 * a client's people are. Portal access is separate.
 */
export async function fetchContactsForClient(
  clientId: string
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
    })
    .from(clients)
    .innerJoin(memberships, eq(memberships.companyId, clients.companyId))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        eq(clients.id, clientId),
        isNull(memberships.endedAt),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(desc(memberships.isPrimary), asc(contacts.email))
}
