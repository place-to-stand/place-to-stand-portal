import { and, eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import {
  contactCreatedEvent,
  contactUpdatedEvent,
} from '@/lib/activity/events/contacts'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, contacts, leads } from '@/lib/db/schema'
import {
  findOrCreateCompanyByName,
  getLinkableCompany,
} from '@/lib/queries/companies'
import {
  companyMoveError,
  syncCompanyClientLinksTx,
} from '@/lib/queries/companies/people-links'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
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
  email: string | null
  name: string
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  companyId: string | null
  userId: string | null
}

/**
 * The company a save points at. A `companyId` from the picker wins (null
 * clears it; the current link is kept even if that company is archived).
 * Otherwise by name: `undefined` keeps the current one, a blank name clears
 * it, anything else finds or creates the company by name.
 */
async function resolveCompanyId(
  user: AppUser,
  companyName: string | null | undefined,
  current: string | null,
  companyId?: string | null
): Promise<string | null> {
  if (companyId !== undefined) {
    if (companyId === null || companyId === current) return companyId
    const company = await getLinkableCompany(companyId)
    if (!company) throw new Error('That company no longer exists.')
    return company.id
  }
  if (companyName === undefined) return current
  if (companyName === null) return null

  // The name of the company it's already linked to (archived or not) keeps
  // the link, rather than creating a live twin of an archived company.
  if (current) {
    const [linked] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, current))
      .limit(1)
    if (
      linked &&
      linked.name.trim().toLowerCase() === companyName.trim().toLowerCase()
    ) {
      return current
    }
  }

  const company = await findOrCreateCompanyByName(user, companyName)
  return company?.id ?? null
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
              userId: contacts.userId,
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
            existingContact.companyId,
            parsed.data.companyId
          )
        } catch (error) {
          console.error('Failed to resolve contact company', error)
          return buildMutationResult({ error: 'Unable to save the company.' })
        }

        // Only a contact with a portal account gains or loses access.
        const moveError = await companyMoveError(
          user,
          existingContact,
          existingContact.companyId,
          companyId
        )
        if (moveError) return buildMutationResult({ error: moveError })

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
        }

        const labels: Record<keyof typeof next, string> = {
          email: 'email',
          name: 'name',
          phone: 'phone',
          jobTitle: 'job title',
          linkedinUrl: 'LinkedIn',
          companyId: 'company',
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

        let linkChanges: ContactClientLinkChange[] = []
        try {
          await db.transaction(async tx => {
            await tx
              .update(contacts)
              .set({ ...next, updatedAt: new Date().toISOString() })
              .where(eq(contacts.id, id))

            // Leaving a company gives up being its primary contact.
            if (existingContact.companyId && existingContact.companyId !== next.companyId) {
              await tx
                .update(companies)
                .set({ primaryContactId: null })
                .where(
                  and(
                    eq(companies.id, existingContact.companyId),
                    eq(companies.primaryContactId, id)
                  )
                )
            }

            // Leads keep a display copy of their contact's details.
            await tx
              .update(leads)
              .set({
                contactName: next.name,
                contactEmail: next.email,
                contactPhone: next.phone,
              })
              .where(eq(leads.contactId, id))

            // A client's people are its company's people: joining a company
            // links them to its clients, leaving one unlinks them, with
            // portal access following in the same transaction.
            if (existingContact.companyId !== next.companyId) {
              linkChanges = await syncCompanyClientLinksTx(
                tx,
                [existingContact.companyId, next.companyId],
                { leftContactIds: [id] }
              )
            }
          })
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

        await logContactClientLinkChanges(user, linkChanges)

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
        companyId = await resolveCompanyId(
          user,
          parsed.data.companyName,
          null,
          parsed.data.companyId
        )
      } catch (error) {
        console.error('Failed to resolve contact company', error)
        return buildMutationResult({ error: 'Unable to save the company.' })
      }

      // A new contact has no portal account, so joining a client's company
      // grants no access: no admin check needed here.
      let createdLinks: ContactClientLinkChange[] = []
      try {
        newContactId = await db.transaction(async tx => {
          const result = await tx
            .insert(contacts)
            .values({
              email,
              name,
              phone,
              jobTitle: parsed.data.jobTitle ?? null,
              linkedinUrl: parsed.data.linkedinUrl ?? null,
              companyId,
              createdBy: user.id,
            })
            .returning({ id: contacts.id })

          const insertedId = result[0]?.id ?? ''
          if (insertedId) {
            createdLinks = await syncCompanyClientLinksTx(tx, [companyId])
          }
          return insertedId
        })
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

      await logContactClientLinkChanges(user, createdLinks)

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
