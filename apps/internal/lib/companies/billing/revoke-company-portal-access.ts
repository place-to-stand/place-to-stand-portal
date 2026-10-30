import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'
import { contacts, memberships } from '@/lib/db/schema'
import type { ContactClientLinkChange } from '@/lib/queries/contacts/settings/contact-client-link-activity'

type Executor = typeof db | DbTx

/**
 * Switches off portal access on every membership at a company, for when its
 * client is unlinked from it or archived. Access is a membership flag, so
 * leaving it on would silently grant the next client linked to the company
 * (or this one, restored) to the same people. Each person whose access
 * changed has `contacts.updated_at` bumped, so a person sheet open on them
 * sees its save refused instead of writing back stale access. Returns the
 * access trail to log with `logContactClientLinkChanges` once the write has
 * landed.
 */
export async function revokeCompanyPortalAccess(
  executor: Executor,
  companyId: string,
  clientCompanyId: string
): Promise<ContactClientLinkChange[]> {
  const timestamp = new Date().toISOString()
  const revoked = await executor
    .update(memberships)
    .set({ portalAccess: false, updatedAt: timestamp })
    .where(
      and(
        eq(memberships.companyId, companyId),
        eq(memberships.portalAccess, true)
      )
    )
    .returning({
      contactId: memberships.contactId,
      endedAt: memberships.endedAt,
    })

  const changedIds = [...new Set(revoked.map(row => row.contactId))]
  if (changedIds.length) {
    await executor
      .update(contacts)
      .set({ updatedAt: timestamp })
      .where(inArray(contacts.id, changedIds))
  }

  // Only a current membership was granting access.
  return revoked
    .filter(row => !row.endedAt)
    .map(row => ({
      contactId: row.contactId,
      clientCompanyId,
      action: 'unlinked' as const,
    }))
}
