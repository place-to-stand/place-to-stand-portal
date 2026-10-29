'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { contactCreatedEvent, leadConvertedEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  clients,
  companies,
  contacts,
  contactClients,
  leads,
} from '@/lib/db/schema'
import { createClient } from '@/lib/settings/clients/actions/create-client'
import { saveProject } from '@/lib/settings/projects/actions/save-project'
import { extractLeadNotes } from '@/lib/leads/notes'
import {
  leadConversionSchema,
  type LeadConversionFormValues,
} from '../conversion-schema'
import type { LeadConversionResult } from '../conversion-types'
import { syncPortalMembershipsForLinkChanges } from '@/lib/queries/contacts/settings/contact-client-portal-memberships'
import { getLinkableCompany } from '@/lib/queries/companies'

export async function convertLeadToClient(
  input: LeadConversionFormValues
): Promise<LeadConversionResult> {
  const user = await requireRole('ADMIN')
  const parsed = leadConversionSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid conversion data.' }
  }

  const {
    leadId,
    clientName,
    clientSlug,
    billingType,
    copyNotesToClient,
    createContact,
    createProject,
    projectName,
    existingClientId,
    memberIds,
  } = parsed.data

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { error: 'Lead not found.' }
  }

  if (lead.convertedToClientId) {
    return { error: 'Lead already converted.' }
  }

  if (lead.status !== 'CLOSED_WON') {
    return { error: 'Only CLOSED_WON leads can be converted.' }
  }

  // The lead's company, when it's still live (an archived one isn't reused).
  const leadCompany = lead.companyId
    ? await getLinkableCompany(lead.companyId)
    : null
  const leadCompanyId = leadCompany?.id ?? null

  let finalClientId: string
  let finalClientSlug: string | undefined

  if (existingClientId) {
    // 2a. Link to existing client
    const [existingClient] = await db
      .select({ id: clients.id, slug: clients.slug })
      .from(clients)
      .where(and(eq(clients.id, existingClientId), isNull(clients.deletedAt)))
      .limit(1)

    if (!existingClient) {
      return { error: 'Selected client not found.' }
    }

    finalClientId = existingClient.id
    finalClientSlug = existingClient.slug ?? undefined
  } else {
    // 2b. Create a new client (reuse existing action)
    // The company owns the name: a lead with a company makes a client
    // named after it; otherwise the typed name names the new company too.
    const resolvedName =
      leadCompany?.name || clientName || lead.companyName || lead.contactName
    const [leadCompanyRow] = leadCompanyId
      ? await db
          .select({ website: companies.website })
          .from(companies)
          .where(eq(companies.id, leadCompanyId))
          .limit(1)
      : []
    const leadCompanyWebsite = leadCompanyRow?.website?.trim() || null
    const resolvedNotes = copyNotesToClient
      ? extractLeadNotes(lead.notes as Record<string, unknown>)
      : null

    const clientResult = await createClient(
      { user },
      {
        name: resolvedName,
        providedSlug: clientSlug || null,
        billingType,
        state: null,
        // The company owns the website; older leads may only have their copy.
        website: leadCompanyWebsite || lead.companyWebsite || null,
        originationContactId: null,
        originationUserId: null,
        closers: [],
        notes: resolvedNotes,
        memberIds: memberIds || [],
        // The client is the lead's company (createClient finds or creates
        // one by name when the lead has none, or it was archived).
        companyId: leadCompanyId,
      }
    )

    if (clientResult.error || !clientResult.clientId) {
      return { error: clientResult.error || 'Failed to create client.' }
    }

    const [createdClient] = await db
      .select({ slug: clients.slug })
      .from(clients)
      .where(eq(clients.id, clientResult.clientId))
      .limit(1)

    finalClientId = clientResult.clientId
    finalClientSlug = createdClient?.slug ?? undefined
  }

  // An existing client becomes the lead's company when it has none yet.
  if (existingClientId && leadCompanyId) {
    await db
      .update(clients)
      .set({ companyId: leadCompanyId, updatedAt: new Date().toISOString() })
      .where(and(eq(clients.id, finalClientId), isNull(clients.companyId)))
  }

  // 3. Link the lead's contact to the client (creating it from the lead's
  // details for an older lead without one).
  const warnings: string[] = []
  const contactEmail = lead.contactEmail
  if (createContact && (lead.contactId || contactEmail)) {
    try {
      const [existingContact] = lead.contactId
        ? await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(eq(contacts.id, lead.contactId), isNull(contacts.deletedAt))
            )
            .limit(1)
        : await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.email, contactEmail ?? ''),
                isNull(contacts.deletedAt)
              )
            )
            .limit(1)

      let contactId = existingContact?.id

      if (!contactId) {
        const [newContact] = await db
          .insert(contacts)
          .values({
            email: contactEmail,
            name: lead.contactName,
            phone: lead.contactPhone,
            createdBy: user.id,
          })
          .returning({ id: contacts.id })

        if (!newContact) {
          throw new Error('Contact insert returned no rows')
        }
        contactId = newContact.id

        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          targetType: 'CONTACT',
          targetId: contactId,
          targetClientId: finalClientId,
          ...contactCreatedEvent({
            email: contactEmail,
            name: lead.contactName,
          }),
        })
      }

      // Winning the lead is the one deliberate step that puts its contact
      // on the client: they join its company when they're on record nowhere
      // else, then get portal access.
      await db
        .update(contacts)
        .set({
          companyId: sql`(select company_id from clients where id = ${finalClientId})`,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(contacts.id, contactId), isNull(contacts.companyId)))
      // Portal access is only for people at the client's company.
      const [placement] = await db
        .select({
          contactCompanyId: contacts.companyId,
          clientCompanyId: clients.companyId,
        })
        .from(contacts)
        .innerJoin(clients, eq(clients.id, finalClientId))
        .where(eq(contacts.id, contactId))
        .limit(1)
      const atClientCompany =
        Boolean(placement?.clientCompanyId) &&
        placement?.contactCompanyId === placement?.clientCompanyId
      if (!atClientCompany) {
        warnings.push(
          `${lead.contactName} isn’t at this client’s company, so they weren’t given portal access. Add them to the company first.`
        )
      }

      // Link contact to client (ignore if already linked)
      const [existingLink] = await db
        .select({ id: contactClients.id })
        .from(contactClients)
        .where(
          and(
            eq(contactClients.contactId, contactId),
            eq(contactClients.clientId, finalClientId)
          )
        )
        .limit(1)

      if (atClientCompany && !existingLink) {
        await db.insert(contactClients).values({
          contactId,
          clientId: finalClientId,
        })
        // An existing contact may already have a portal account.
        await syncPortalMembershipsForLinkChanges([
          { contactId, clientId: finalClientId, action: 'linked' },
        ])
      }

      // The client's company takes this contact as its primary when it has
      // none yet, and the contact works there (or nowhere on record).
      await db
        .update(companies)
        .set({
          primaryContactId: contactId,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            isNull(companies.primaryContactId),
            sql`${companies.id} = (select company_id from clients where id = ${finalClientId})`,
            sql`exists (
              select 1 from contacts ct
              where ct.id = ${contactId}
                and (ct.company_id is null or ct.company_id = ${companies.id})
            )`
          )
        )
    } catch (err) {
      console.error('[convert-lead] Failed to create contact:', err)
      warnings.push(
        'Contact record could not be created. You can add it manually from the client page.'
      )
    }
  }

  // 4. Create a project linked to the client (if requested)
  let projectId: string | undefined
  if (createProject && projectName) {
    try {
      const projectResult = await saveProject({
        name: projectName,
        projectType: 'CLIENT',
        clientId: finalClientId,
        status: 'ACTIVE',
        startsOn: null,
        endsOn: null,
        slug: null,
        ownerId: null,
      })

      if (projectResult.error) {
        console.error(
          '[convert-lead] Failed to create project:',
          projectResult.error
        )
        warnings.push(`Project could not be created: ${projectResult.error}`)
      } else {
        projectId = projectResult.projectId
      }
    } catch (err) {
      console.error('[convert-lead] Failed to create project:', err)
      warnings.push(
        'Project could not be created. You can create it manually from settings.'
      )
    }
  }

  // 5. Update the lead with conversion info
  await db
    .update(leads)
    .set({
      convertedAt: new Date().toISOString(),
      convertedToClientId: finalClientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(leads.id, leadId))

  // 6. Log activity
  const resolvedName =
    leadCompany?.name || clientName || lead.companyName || lead.contactName
  const event = leadConvertedEvent({
    leadId,
    leadName: lead.contactName,
    clientId: finalClientId,
    clientName: resolvedName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'LEAD',
    targetId: leadId,
    targetClientId: finalClientId,
    metadata: event.metadata,
  })

  revalidatePath('/leads')
  revalidatePath('/clients')
  revalidatePath('/companies')

  return {
    clientId: finalClientId,
    clientSlug: finalClientSlug,
    projectId,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
