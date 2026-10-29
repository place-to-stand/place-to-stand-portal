import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { memberships } from '@/lib/db/schema'
import type { ContactClientLinkChange } from '@/lib/queries/contacts/settings/contact-client-link-activity'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/**
 * Switches off portal access on every membership at a company, for when its
 * client is unlinked from it or archived. Access is a membership flag, so
 * leaving it on would silently grant the next client linked to the company
 * (or this one, restored) to the same people. Returns the access trail to
 * log with `logContactClientLinkChanges` once the write has landed.
 */
export async function revokeCompanyPortalAccess(
  executor: Executor,
  companyId: string,
  clientId: string
): Promise<ContactClientLinkChange[]> {
  const revoked = await executor
    .update(memberships)
    .set({ portalAccess: false, updatedAt: new Date().toISOString() })
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

  // Only a current membership was granting access.
  return revoked
    .filter(row => !row.endedAt)
    .map(row => ({
      contactId: row.contactId,
      clientId,
      action: 'unlinked' as const,
    }))
}

