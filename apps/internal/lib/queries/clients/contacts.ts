import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, companies, contacts, contactClients } from '@/lib/db/schema'
import { isClientPrimaryContactSql } from '@/lib/queries/clients/primary-contact'

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
 * Contacts linked to a client through `contact_clients`, plus its company's
 * primary contact even when they aren't linked (clients use their
 * company's primary contact), primary first then by email. Shared by the
 * client detail page, invoice emails and the update composer so all agree
 * on who a client's people are.
 */
export async function fetchContactsForClient(
  clientId: string
): Promise<ClientContactRow[]> {
  const fields = {
    id: contacts.id,
    email: contacts.email,
    name: contacts.name,
    phone: contacts.phone,
    createdBy: contacts.createdBy,
    userId: contacts.userId,
    createdAt: contacts.createdAt,
    updatedAt: contacts.updatedAt,
    deletedAt: contacts.deletedAt,
  }

  const [linked, [primary]] = await Promise.all([
    db
      .select({ ...fields, isPrimary: isClientPrimaryContactSql })
      .from(contactClients)
      .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
      .where(
        and(eq(contactClients.clientId, clientId), isNull(contacts.deletedAt))
      )
      .orderBy(desc(isClientPrimaryContactSql), contacts.email),
    db
      .select(fields)
      .from(clients)
      .innerJoin(companies, eq(companies.id, clients.companyId))
      .innerJoin(contacts, eq(contacts.id, companies.primaryContactId))
      .where(and(eq(clients.id, clientId), isNull(contacts.deletedAt)))
      .limit(1),
  ])

  if (!primary || linked.some(contact => contact.id === primary.id)) {
    return linked
  }
  return [{ ...primary, isPrimary: true }, ...linked]
}
