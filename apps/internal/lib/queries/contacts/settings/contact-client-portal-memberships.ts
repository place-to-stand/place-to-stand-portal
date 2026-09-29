import 'server-only'

import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientMembers, contacts } from '@/lib/db/schema'

import type { ContactClientLinkChange } from './contact-client-link-activity'

/**
 * Keeps portal access (`client_members`) in step with contact ↔ client links.
 * A linked contact with a portal account gets (or regains) membership of the
 * client; an unlinked one loses it. Contacts without an account are skipped —
 * promotion creates their memberships from the links at that point.
 *
 * Both link directions (contact sheet and client sheet) must call this after
 * writing `contact_clients`: the client portal scopes real users by
 * `client_members`, while the admin "preview as contact" scopes by
 * `contact_clients`, so a missed sync is invisible in preview.
 */
export async function syncPortalMembershipsForLinkChanges(
  changes: ContactClientLinkChange[]
): Promise<void> {
  if (changes.length === 0) return

  const contactIds = [...new Set(changes.map(change => change.contactId))]
  const portalContacts = await db
    .select({ id: contacts.id, userId: contacts.userId })
    .from(contacts)
    .where(
      and(
        inArray(contacts.id, contactIds),
        isNull(contacts.deletedAt),
        isNotNull(contacts.userId)
      )
    )

  const userIdByContact = new Map(
    portalContacts.map(contact => [contact.id, contact.userId!])
  )
  const memberships = (action: ContactClientLinkChange['action']) =>
    changes.flatMap(change => {
      const userId = userIdByContact.get(change.contactId)
      return change.action === action && userId
        ? [{ clientId: change.clientId, userId }]
        : []
    })

  const toGrant = memberships('linked')
  const toRevoke = memberships('unlinked')

  if (toGrant.length > 0) {
    await db
      .insert(clientMembers)
      .values(toGrant.map(membership => ({ ...membership, deletedAt: null })))
      .onConflictDoUpdate({
        target: [clientMembers.clientId, clientMembers.userId],
        set: { deletedAt: null },
      })
  }

  if (toRevoke.length > 0) {
    await db
      .update(clientMembers)
      .set({ deletedAt: new Date().toISOString() })
      .where(
        and(
          isNull(clientMembers.deletedAt),
          or(
            ...toRevoke.map(membership =>
              and(
                eq(clientMembers.clientId, membership.clientId),
                eq(clientMembers.userId, membership.userId)
              )
            )
          )
        )
      )
  }
}
