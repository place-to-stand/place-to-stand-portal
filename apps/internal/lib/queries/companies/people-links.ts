import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, contactClients, contacts } from '@/lib/db/schema'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { syncPortalMembershipsForLinkChanges } from '@/lib/queries/contacts/settings/contact-client-portal-memberships'

/**
 * A client's people are its company's people. `contact_clients` (which the
 * client portal, invoice recipients and "preview as contact" read) is kept
 * as a derived copy: every live contact at a company is linked to every live
 * client of that company.
 *
 * Call this after anything that changes who is at a company or which company
 * a client is (a contact's company, a client's company, a new client or
 * contact). It adds the missing links. Pass `leftContactIds` for people who
 * just left one of these companies: their links to its clients are removed.
 * Nothing else is unlinked, so older hand-made links to another company's
 * client survive and nobody loses portal access unannounced. Portal access
 * follows every change.
 */
export async function syncCompanyClientLinks(
  actor: AppUser,
  companyIds: ReadonlyArray<string | null | undefined>,
  options: { leftContactIds?: readonly string[] } = {}
): Promise<void> {
  const ids = [...new Set(companyIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return

  const [people, companyClients] = await Promise.all([
    db
      .select({ id: contacts.id, companyId: contacts.companyId })
      .from(contacts)
      .where(and(inArray(contacts.companyId, ids), isNull(contacts.deletedAt))),
    db
      .select({ id: clients.id, companyId: clients.companyId })
      .from(clients)
      .where(and(inArray(clients.companyId, ids), isNull(clients.deletedAt))),
  ])
  if (companyClients.length === 0) return

  const clientIds = companyClients.map(client => client.id)
  const existing = await db
    .select({
      contactId: contactClients.contactId,
      clientId: contactClients.clientId,
      contactCompanyId: contacts.companyId,
      contactDeletedAt: contacts.deletedAt,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contacts.id, contactClients.contactId))
    .where(inArray(contactClients.clientId, clientIds))

  const companyOfClient = new Map(companyClients.map(c => [c.id, c.companyId]))
  const key = (contactId: string, clientId: string) => `${contactId}:${clientId}`
  const have = new Set(existing.map(link => key(link.contactId, link.clientId)))

  const changes: ContactClientLinkChange[] = []
  for (const client of companyClients) {
    for (const person of people) {
      if (person.companyId === client.companyId && !have.has(key(person.id, client.id))) {
        changes.push({ contactId: person.id, clientId: client.id, action: 'linked' })
      }
    }
  }
  const left = new Set(options.leftContactIds ?? [])
  for (const link of existing) {
    const clientCompany = companyOfClient.get(link.clientId)
    if (left.has(link.contactId) && link.contactCompanyId !== clientCompany) {
      changes.push({ contactId: link.contactId, clientId: link.clientId, action: 'unlinked' })
    }
  }

  const toAdd = changes.filter(change => change.action === 'linked')
  const toRemove = changes.filter(change => change.action === 'unlinked')

  if (toAdd.length > 0) {
    await db
      .insert(contactClients)
      .values(toAdd.map(({ contactId, clientId }) => ({ contactId, clientId })))
      .onConflictDoNothing({
        target: [contactClients.contactId, contactClients.clientId],
      })
  }
  for (const change of toRemove) {
    await db
      .delete(contactClients)
      .where(
        and(
          eq(contactClients.contactId, change.contactId),
          eq(contactClients.clientId, change.clientId)
        )
      )
  }

  await syncPortalMembershipsForLinkChanges(changes)
  await logContactClientLinkChanges(actor, changes)
}
