'use server'

import { asc, and, eq, isNull } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, contacts, contactClients } from '@/lib/db/schema'

export type ClientForProposal = {
  id: string
  name: string
  slug: string | null
  website: string | null
  primaryContactName: string | null
  primaryContactEmail: string | null
  primaryContactPhone: string | null
}

export async function fetchClientsForProposals(): Promise<ClientForProposal[]> {
  await requireRole('ADMIN')

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
      website: clients.website,
      contactName: contacts.name,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
    })
    .from(clients)
    .leftJoin(
      contactClients,
      and(
        eq(contactClients.clientId, clients.id),
        eq(contactClients.isPrimary, true)
      )
    )
    .leftJoin(
      contacts,
      and(
        eq(contacts.id, contactClients.contactId),
        isNull(contacts.deletedAt)
      )
    )
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    website: r.website,
    primaryContactName: r.contactName,
    primaryContactEmail: r.contactEmail,
    primaryContactPhone: r.contactPhone,
  }))
}
