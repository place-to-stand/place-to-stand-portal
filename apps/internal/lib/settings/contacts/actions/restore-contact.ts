import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactRestoredEvent } from '@/lib/activity/events/contacts'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { syncCompanyClientLinksTx } from '@/lib/queries/companies/people-links'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
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
        assertCrmAccess(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'CRM access required.' })
      }

      let existingContact:
        | {
            id: string
            email: string | null
            name: string | null
            companyId: string | null
            userId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            name: contacts.name,
            companyId: contacts.companyId,
            userId: contacts.userId,
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

      // Back at their company, they get any of its clients added while they
      // were archived. For a portal user that grants access, which only an
      // admin may do; otherwise an admin's next save of them catches up.
      const restored = existingContact
      const syncLinks =
        Boolean(restored.companyId) &&
        (!restored.userId || roleCan(user.role, 'clients.manage'))
      let linkChanges: ContactClientLinkChange[] = []
      try {
        await db.transaction(async tx => {
          await tx
            .update(contacts)
            .set({ deletedAt: null })
            .where(eq(contacts.id, parsed.data.id))
          if (syncLinks) {
            linkChanges = await syncCompanyClientLinksTx(tx, [
              restored.companyId,
            ])
          }
        })
      } catch (error) {
        console.error('Failed to restore contact', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to restore contact.',
        })
      }

      await logContactClientLinkChanges(user, linkChanges)

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
