import { clientEndedAtSql } from '@pts/db/client-state'
import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactArchivedEvent } from '@/lib/activity/events/contacts'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, contacts, memberships, users } from '@/lib/db/schema'
import { atClientCompanySql } from '@/lib/queries/memberships'
import { setPortalUserDisabled } from '@/lib/settings/users/services'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
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
        | {
            id: string
            email: string | null
            name: string | null
            userId: string | null
            atClient: boolean
          }
        | undefined
      let accessRows: {
        companyId: string
        clientCompanyId: string | null
        endedAt: string | null
      }[] = []

      try {
        const rows = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            name: contacts.name,
            userId: contacts.userId,
            atClient: atClientCompanySql(contacts.id),
          })
          .from(contacts)
          .where(eq(contacts.id, parsed.data.id))
          .limit(1)

        existingContact = rows[0]
        // Memberships with portal access on (ended or not: archiving switches
        // them all off), and the live client each one opens.
        accessRows = await db
          .select({
            companyId: memberships.companyId,
            clientCompanyId: companies.id,
            endedAt: memberships.endedAt,
          })
          .from(memberships)
          .leftJoin(
            companies,
            and(
              eq(companies.id, memberships.companyId),
              isNull(clientEndedAtSql)
            )
          )
          .where(
            and(
              eq(memberships.contactId, parsed.data.id),
              eq(memberships.portalAccess, true)
            )
          )
      } catch (error) {
        console.error('Failed to load contact for archive', error)
        return buildMutationResult({ error: 'Unable to archive person.' })
      }

      if (!existingContact) {
        return buildMutationResult({ error: 'Person not found.' })
      }

      // Archiving a portal user ends their portal access, which only an
      // admin may switch off.
      if (
        !roleCan(user.role, 'clients.manage') &&
        (existingContact.userId || accessRows.length > 0)
      ) {
        return buildMutationResult({
          error: 'This person is a portal user. Ask an admin to archive them.',
        })
      }
      // A client's people are who it bills, so they're admin-only too.
      if (!roleCan(user.role, 'clients.manage') && existingContact.atClient) {
        return buildMutationResult({
          error:
            'This person is at a client, so only an admin can archive them.',
        })
      }

      if (existingContact.userId && existingContact.userId === user.id) {
        return buildMutationResult({ error: 'You can’t archive yourself.' })
      }

      try {
        // Archiving ends their portal access for good: restoring the contact
        // later does not bring it back (only an admin switches access on).
        await db.transaction(async tx => {
          await tx
            .update(contacts)
            .set({
              deletedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
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
          // An archived person can't sign in: their sign-in is switched off
          // with the archive (restoring the person doesn't switch it back).
          if (existingContact?.userId) {
            await tx
              .update(users)
              .set({ disabledAt: new Date().toISOString() })
              .where(
                and(
                  eq(users.id, existingContact.userId),
                  isNull(users.disabledAt)
                )
              )
          }
        })
      } catch (error) {
        console.error('Failed to archive contact', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to archive person.',
        })
      }

      // The rest of the off switch: ban the auth account and revoke
      // provider connections (the flag above already blocks sign-in).
      if (existingContact.userId) {
        const offResult = await setPortalUserDisabled(user, {
          id: existingContact.userId,
          disabled: true,
        })
        if (offResult.error) {
          console.error(
            'Archived contact, but sign-in off failed',
            offResult.error
          )
          return buildMutationResult({
            error: `Archived, but their sign-in could not be fully switched off: ${offResult.error}. Turn it off on their sign-in.`,
          })
        }
      }

      // Access trail on each client they lose, as on the company sheet.
      const accessChanges: ContactClientLinkChange[] = []
      for (const row of accessRows) {
        // Only a current membership was granting access.
        if (!row.clientCompanyId || row.endedAt) continue
        accessChanges.push({
          contactId: existingContact.id,
          clientCompanyId: row.clientCompanyId,
          action: 'unlinked',
        })
      }
      await logContactClientLinkChanges(user, accessChanges)

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
