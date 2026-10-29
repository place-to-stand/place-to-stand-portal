import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { roleCan } from '@/lib/auth/capabilities'
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
 *
 * Moving people in or out of a company that has clients changes portal
 * access, which is admin-only: callers check `clients.manage` first.
 */
type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

/**
 * Same as `syncCompanyClientLinks`, inside the caller's transaction, so the
 * change that moved someone (a contact's company, a client's company), the
 * derived links and portal access commit together or not at all. Returns
 * the link changes; log them with `logContactClientLinkChanges` after commit.
 */
export async function syncCompanyClientLinksTx(
  tx: Executor,
  companyIds: ReadonlyArray<string | null | undefined>,
  options: { leftContactIds?: readonly string[] } = {}
): Promise<ContactClientLinkChange[]> {
  const ids = [...new Set(companyIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return []

  // Archived clients count for removals: someone who left keeps no link to
  // an archived client that a later restore would bring back to life.
  const [people, companyClients] = await Promise.all([
    tx
      .select({ id: contacts.id, companyId: contacts.companyId })
      .from(contacts)
      .where(and(inArray(contacts.companyId, ids), isNull(contacts.deletedAt))),
    tx
      .select({
        id: clients.id,
        companyId: clients.companyId,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(inArray(clients.companyId, ids)),
  ])
  if (companyClients.length === 0) return []

  const clientIds = companyClients.map(client => client.id)
  const existing = await tx
    .select({
      contactId: contactClients.contactId,
      clientId: contactClients.clientId,
      contactCompanyId: contacts.companyId,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contacts.id, contactClients.contactId))
    .where(inArray(contactClients.clientId, clientIds))

  const companyOfClient = new Map(companyClients.map(c => [c.id, c.companyId]))
  const key = (contactId: string, clientId: string) => `${contactId}:${clientId}`
  const have = new Set(existing.map(link => key(link.contactId, link.clientId)))

  const changes: ContactClientLinkChange[] = []
  for (const client of companyClients) {
    if (client.deletedAt) continue
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
    await tx
      .insert(contactClients)
      .values(toAdd.map(({ contactId, clientId }) => ({ contactId, clientId })))
      .onConflictDoNothing({
        target: [contactClients.contactId, contactClients.clientId],
      })
  }
  for (const change of toRemove) {
    await tx
      .delete(contactClients)
      .where(
        and(
          eq(contactClients.contactId, change.contactId),
          eq(contactClients.clientId, change.clientId)
        )
      )
  }

  // Derived links never bring back access an admin revoked.
  await syncPortalMembershipsForLinkChanges(changes, tx, {
    restoreRevoked: false,
  })
  return changes
}

/** `syncCompanyClientLinksTx` in its own transaction, then logged. */
export async function syncCompanyClientLinks(
  actor: AppUser,
  companyIds: ReadonlyArray<string | null | undefined>,
  options: { leftContactIds?: readonly string[] } = {}
): Promise<void> {
  const changes = await db.transaction(tx =>
    syncCompanyClientLinksTx(tx, companyIds, options)
  )
  await logContactClientLinkChanges(actor, changes)
}

/**
 * Moving a portal user (a contact with `user_id`) in or out of a company
 * that has clients changes which clients they can see in the portal, which
 * is admin-only (`clients.manage`). Returns why the move is refused, or null
 * when it's allowed. A contact with no portal account can always move.
 */
export async function companyMoveError(
  actor: AppUser,
  contact: { userId: string | null },
  from: string | null,
  to: string | null
): Promise<string | null> {
  if (!contact.userId || from === to || roleCan(actor.role, 'clients.manage')) {
    return null
  }
  const ids = [from, to].filter((id): id is string => Boolean(id))
  if (ids.length === 0) return null
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.companyId, ids))
    .limit(1)
  return client
    ? 'That company is a client, so only an admin can move people in or out of it.'
    : null
}
