import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, contactClients } from '@/lib/db/schema'

import type { ContactClientLinkChange } from './contact-client-link-activity'
import { syncPortalMembershipsForLinkChanges } from './contact-client-portal-memberships'

type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

/**
 * Portal access to a client is only for people at its company. Someone
 * leaving a company loses their access to its client (archived ones too),
 * links and portal membership together, inside the caller's transaction.
 * Returns the changes; log them after commit.
 */
export async function revokeAccessOnLeavingCompany(
  tx: Executor,
  contactId: string,
  companyId: string
): Promise<ContactClientLinkChange[]> {
  const links = await tx
    .select({ clientId: contactClients.clientId })
    .from(contactClients)
    .innerJoin(clients, eq(clients.id, contactClients.clientId))
    .where(
      and(
        eq(contactClients.contactId, contactId),
        eq(clients.companyId, companyId)
      )
    )
  if (!links.length) return []
  const clientIds = links.map(link => link.clientId)
  await tx
    .delete(contactClients)
    .where(
      and(
        eq(contactClients.contactId, contactId),
        inArray(contactClients.clientId, clientIds)
      )
    )
  const changes = clientIds.map(clientId => ({
    contactId,
    clientId,
    action: 'unlinked' as const,
  }))
  await syncPortalMembershipsForLinkChanges(changes, tx)
  return changes
}
