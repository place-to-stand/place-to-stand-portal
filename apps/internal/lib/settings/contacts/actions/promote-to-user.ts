import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import { userCreatedEvent } from '@/lib/activity/events/users'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientPortalAccess, contacts } from '@/lib/db/schema'
import { findOrCreatePortalUser } from '@/lib/settings/users/services/find-or-create-portal-user'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export type PromoteToUserInput = {
  contactId: string
}

export async function promoteContactToUserMutation(
  context: ContactMutationContext,
  input: PromoteToUserInput
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

  // 1. Load and validate contact
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
    return buildMutationResult({ error: 'Cannot promote an archived contact.' })
  }

  if (contact.userId) {
    return buildMutationResult({
      error: 'This contact already has portal access.',
    })
  }

  // Portal access signs in by email, so the contact needs one first.
  const email = contact.email
  if (!email) {
    return buildMutationResult({
      error: 'Add an email to this contact before giving portal access.',
    })
  }

  // 2. Find or create portal user
  const portalResult = await findOrCreatePortalUser(user, {
    email,
    fullName: contact.name,
  })

  if (portalResult.error || !portalResult.userId) {
    return buildMutationResult({
      error: portalResult.error ?? 'Failed to create portal user.',
    })
  }

  const userId = portalResult.userId

  // 3. Link contact to user
  await db
    .update(contacts)
    .set({
      userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(contacts.id, contact.id))

  // 4. Portal access follows the contact's memberships
  // (client_portal_access), so the new login sees those clients at once.
  const linkedClients = await db
    .select({ clientId: clientPortalAccess.clientId })
    .from(clientPortalAccess)
    .where(eq(clientPortalAccess.contactId, contact.id))

  // 5. Log activity events. A contact can be linked to several clients; the
  // rows are scoped to the first one and carry the full list in metadata.
  const clientIds = linkedClients.map(lc => lc.clientId)
  const primaryClientId = clientIds[0] ?? null

  if (portalResult.created) {
    const userEvent = userCreatedEvent({
      fullName: contact.name || email,
      role: 'CLIENT',
      email,
      clientIds,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: userEvent.verb,
      summary: userEvent.summary,
      targetType: 'USER',
      targetId: userId,
      targetClientId: primaryClientId,
      metadata: userEvent.metadata,
    })
  }

  const contactEvent = contactInvitedToPortalEvent({
    email,
    name: contact.name,
    clientIds,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: contactEvent.verb,
    summary: contactEvent.summary,
    targetType: 'CONTACT',
    targetId: contact.id,
    targetClientId: primaryClientId,
    metadata: contactEvent.metadata,
  })

  return buildMutationResult({})
}
