import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactDeletedEvent } from '@/lib/activity/events/contacts'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import {
  destroyContactSchema,
  type DestroyContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export async function destroyContactMutation(
  context: ContactMutationContext,
  input: DestroyContactInput
): Promise<ContactMutationResult> {
  const parsed = destroyContactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid delete request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: 'destroy',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertAdmin(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'Admin privileges required.' })
      }

      let existingContact:
        | { id: string; email: string; name: string | null; deletedAt: string | null }
        | undefined

      try {
        const rows = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            name: contacts.name,
            deletedAt: contacts.deletedAt,
          })
          .from(contacts)
          .where(eq(contacts.id, parsed.data.id))
          .limit(1)

        existingContact = rows[0]
      } catch (error) {
        console.error('Failed to load contact for destroy', error)
        return buildMutationResult({
          error: 'Unable to permanently delete contact.',
        })
      }

      if (!existingContact) {
        return buildMutationResult({ error: 'Contact not found.' })
      }

      if (!existingContact.deletedAt) {
        return buildMutationResult({
          error: 'Contact must be archived before permanent deletion.',
        })
      }

      try {
        await db.delete(contacts).where(eq(contacts.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to destroy contact', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete contact.',
        })
      }

      const event = contactDeletedEvent({
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
