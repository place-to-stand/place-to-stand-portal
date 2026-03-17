import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactRestoredEvent } from '@/lib/activity/events/contacts'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import {
  restoreContactSchema,
  type RestoreContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export async function restoreContactMutation(
  context: ContactMutationContext,
  input: RestoreContactInput
): Promise<ContactMutationResult> {
  const parsed = restoreContactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid restore request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: 'restore',
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
        | { id: string; email: string; name: string | null }
        | undefined

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
        console.error('Failed to load contact for restore', error)
        return buildMutationResult({ error: 'Unable to restore contact.' })
      }

      if (!existingContact) {
        return buildMutationResult({ error: 'Contact not found.' })
      }

      try {
        await db
          .update(contacts)
          .set({ deletedAt: null })
          .where(eq(contacts.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to restore contact', error)
        return buildMutationResult({
          error:
            error instanceof Error ? error.message : 'Unable to restore contact.',
        })
      }

      const event = contactRestoredEvent({
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
