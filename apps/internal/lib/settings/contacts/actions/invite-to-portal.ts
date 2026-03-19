import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  contacts,
  contactClients,
  clients,
  clientMembers,
} from '@/lib/db/schema'
import { findOrCreatePortalUser } from '@/lib/settings/users/services/find-or-create-portal-user'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export async function inviteContactToPortalMutation(
  context: ContactMutationContext,
  input: { contactId: string }
): Promise<ContactMutationResult> {
  const { user } = context

  try {
    assertAdmin(user)
  } catch (error) {
    if (error instanceof Error) {
      return buildMutationResult({ error: error.message })
    }
    return buildMutationResult({ error: 'Admin privileges required.' })
  }

  // 1. Load contact and validate
  const [contact] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      userId: contacts.userId,
      deletedAt: contacts.deletedAt,
    })
    .from(contacts)
    .where(eq(contacts.id, input.contactId))
    .limit(1)

  if (!contact) {
    return buildMutationResult({ error: 'Contact not found.' })
  }

  if (contact.deletedAt) {
    return buildMutationResult({ error: 'Cannot invite an archived contact.' })
  }

  if (contact.userId) {
    return buildMutationResult({
      error: 'This contact already has portal access.',
    })
  }

  // 2. Load contact's linked active clients
  const linkedClients = await db
    .select({
      clientId: contactClients.clientId,
    })
    .from(contactClients)
    .innerJoin(clients, eq(contactClients.clientId, clients.id))
    .where(
      and(
        eq(contactClients.contactId, contact.id),
        isNull(clients.deletedAt)
      )
    )

  if (linkedClients.length === 0) {
    return buildMutationResult({
      error:
        'Contact must be linked to at least one client before inviting to the portal.',
    })
  }

  const linkedClientIds = linkedClients.map(c => c.clientId)

  // 3. Find or create portal user
  const portalResult = await findOrCreatePortalUser(user, {
    email: contact.email,
    fullName: contact.name,
  })

  if (portalResult.error || !portalResult.userId) {
    return buildMutationResult({
      error: portalResult.error ?? 'Failed to create portal user.',
    })
  }

  const userId = portalResult.userId

  // 4. Link contact to user
  await db
    .update(contacts)
    .set({
      userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(contacts.id, contact.id))

  // 5. Insert client_members for each linked client (un-archive if previously removed)
  for (const clientId of linkedClientIds) {
    const [existing] = await db
      .select({
        id: clientMembers.id,
        deletedAt: clientMembers.deletedAt,
      })
      .from(clientMembers)
      .where(
        and(
          eq(clientMembers.clientId, clientId),
          eq(clientMembers.userId, userId)
        )
      )
      .limit(1)

    if (existing) {
      if (existing.deletedAt) {
        // Re-activate previously removed membership
        await db
          .update(clientMembers)
          .set({ deletedAt: null })
          .where(eq(clientMembers.id, existing.id))
      }
      // If not deleted, membership already active — skip
    } else {
      await db.insert(clientMembers).values({
        clientId,
        userId,
      })
    }
  }

  // 6. Log activity
  const event = contactInvitedToPortalEvent({
    email: contact.email,
    name: contact.name,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CONTACT',
    targetId: contact.id,
    metadata: event.metadata,
  })

  return buildMutationResult({})
}
