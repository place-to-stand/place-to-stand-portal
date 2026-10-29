import { and, eq, ne } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactCreatedEvent, contactUpdatedEvent } from '@/lib/activity/events/contacts'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { findOrCreateCompanyByName } from '@/lib/queries/companies'
import {
  contactSchema,
  type ContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

type ExistingContact = {
  id: string
  email: string
  name: string
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  companyId: string | null
  isChampion: boolean
}

/**
 * The company a save points at: `undefined` keeps the current one, a blank
 * name clears it, anything else finds or creates the company by name.
 */
async function resolveCompanyId(
  user: AppUser,
  companyName: string | null | undefined,
  current: string | null
): Promise<string | null> {
  if (companyName === undefined) return current
  if (companyName === null) return null
  const company = await findOrCreateCompanyByName(user, companyName)
  return company?.id ?? null
}

/** A company has one champion: clear the flag on everyone else there. */
async function clearOtherChampions(companyId: string, contactId: string) {
  await db
    .update(contacts)
    .set({ isChampion: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(contacts.companyId, companyId),
        eq(contacts.isChampion, true),
        ne(contacts.id, contactId)
      )
    )
}

export async function saveContactMutation(
  context: ContactMutationContext,
  input: ContactInput
): Promise<ContactMutationResult> {
  const parsed = contactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({
      error: parsed.error.issues[0]?.message ?? 'Invalid contact data.',
    })
  }

  const isUpdate = Boolean(parsed.data.id)

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: isUpdate ? 'edit' : 'create',
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

      const { id, email, name, phone } = parsed.data

      if (isUpdate && id) {
        let existingContact: ExistingContact | undefined

        try {
          const rows = await db
            .select({
              id: contacts.id,
              email: contacts.email,
              name: contacts.name,
              phone: contacts.phone,
              jobTitle: contacts.jobTitle,
              linkedinUrl: contacts.linkedinUrl,
              companyId: contacts.companyId,
              isChampion: contacts.isChampion,
            })
            .from(contacts)
            .where(eq(contacts.id, id))
            .limit(1)

          existingContact = rows[0]
        } catch (error) {
          console.error('Failed to load contact for update', error)
          return buildMutationResult({ error: 'Unable to update contact.' })
        }

        if (!existingContact) {
          return buildMutationResult({ error: 'Contact not found.' })
        }

        let companyId: string | null
        try {
          companyId = await resolveCompanyId(
            user,
            parsed.data.companyName,
            existingContact.companyId
          )
        } catch (error) {
          console.error('Failed to resolve contact company', error)
          return buildMutationResult({ error: 'Unable to save the company.' })
        }

        const next = {
          email,
          name,
          phone: phone ?? null,
          jobTitle:
            parsed.data.jobTitle === undefined
              ? existingContact.jobTitle
              : parsed.data.jobTitle,
          linkedinUrl:
            parsed.data.linkedinUrl === undefined
              ? existingContact.linkedinUrl
              : parsed.data.linkedinUrl,
          companyId,
          // No company, no champion.
          isChampion: companyId
            ? (parsed.data.isChampion ?? existingContact.isChampion)
            : false,
        }

        const labels: Record<keyof typeof next, string> = {
          email: 'email',
          name: 'name',
          phone: 'phone',
          jobTitle: 'job title',
          linkedinUrl: 'LinkedIn',
          companyId: 'company',
          isChampion: 'champion',
        }
        const changedFields: string[] = []
        const before: Record<string, unknown> = {}
        const after: Record<string, unknown> = {}

        for (const key of Object.keys(next) as (keyof typeof next)[]) {
          if (existingContact[key] !== next[key]) {
            changedFields.push(labels[key])
            before[key] = existingContact[key]
            after[key] = next[key]
          }
        }

        try {
          await db
            .update(contacts)
            .set({ ...next, updatedAt: new Date().toISOString() })
            .where(eq(contacts.id, id))

          if (next.isChampion && next.companyId) {
            await clearOtherChampions(next.companyId, id)
          }
        } catch (error) {
          console.error('Failed to update contact', error)
          if (
            error instanceof Error &&
            String(error.message + String(error.cause ?? '')).includes(
              'contacts_email_key'
            )
          ) {
            return buildMutationResult({
              error: 'A contact with this email already exists.',
            })
          }
          return buildMutationResult({ error: 'Unable to update contact.' })
        }

        if (changedFields.length > 0) {
          const event = contactUpdatedEvent({
            email,
            name,
            changedFields,
            details: { before, after },
          })

          await logActivity({
            actorId: user.id,
            actorRole: user.role,
            verb: event.verb,
            summary: event.summary,
            targetType: 'CONTACT',
            targetId: id,
            metadata: event.metadata,
          })
        }

        return buildMutationResult({})
      }

      // Create new contact
      let newContactId: string
      let companyId: string | null

      try {
        companyId = await resolveCompanyId(user, parsed.data.companyName, null)
      } catch (error) {
        console.error('Failed to resolve contact company', error)
        return buildMutationResult({ error: 'Unable to save the company.' })
      }

      try {
        const result = await db
          .insert(contacts)
          .values({
            email,
            name,
            phone,
            jobTitle: parsed.data.jobTitle ?? null,
            linkedinUrl: parsed.data.linkedinUrl ?? null,
            companyId,
            isChampion: Boolean(companyId && parsed.data.isChampion),
            createdBy: user.id,
          })
          .returning({ id: contacts.id })

        newContactId = result[0]?.id ?? ''
      } catch (error) {
        console.error('Failed to create contact', error)
        // Check for unique constraint violation on email
        if (
          error instanceof Error &&
          String(error.message + String(error.cause ?? '')).includes(
            'contacts_email_key'
          )
        ) {
          return buildMutationResult({
            error: 'A contact with this email already exists.',
          })
        }
        return buildMutationResult({ error: 'Unable to create contact.' })
      }

      if (companyId && parsed.data.isChampion && newContactId) {
        await clearOtherChampions(companyId, newContactId)
      }

      const event = contactCreatedEvent({ email, name })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CONTACT',
        targetId: newContactId,
        metadata: event.metadata,
      })

      return buildMutationResult({ id: newContactId })
    }
  )
}
