import { and, eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactArchivedEvent } from '@/lib/activity/events/contacts'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { contacts, memberships } from '@/lib/db/schema'
import {
  deleteContactSchema,
  type DeleteContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export async function softDeleteContactMutation(
  context: ContactMutationContext,
  input: DeleteContactInput
): Promise<ContactMutationResult> {
  const parsed = deleteContactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid delete request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: 'delete',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertCrmAccess(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'CRM access required.' })
      }

      let existingContact:
        { id: string; email: string | null; name: string | null } | undefined

      try {
        const rows = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            name: contacts.name,
          })
          .from(contacts)
          .where(eq(contacts.id, parsed.data.id))
          .limit(1)

        existingContact = rows[0]
      } catch (error) {
        console.error('Failed to load contact for archive', error)
        return buildMutationResult({ error: 'Unable to archive contact.' })
      }

      if (!existingContact) {
        return buildMutationResult({ error: 'Contact not found.' })
      }

      try {
        // Archiving ends their portal access for good: restoring the contact
        // later does not bring it back (only an admin switches access on).
        await db.transaction(async tx => {
          await tx
            .update(contacts)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(contacts.id, parsed.data.id))
          await tx
            .update(memberships)
            .set({ portalAccess: false, updatedAt: new Date().toISOString() })
            .where(
              and(
                eq(memberships.contactId, parsed.data.id),
                eq(memberships.portalAccess, true)
              )
            )
        })
      } catch (error) {
        console.error('Failed to archive contact', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to archive contact.',
        })
      }

      const event = contactArchivedEvent({
        email: existingContact.email,
        name: existingContact.name,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CONTACT',
        targetId: existingContact.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}
