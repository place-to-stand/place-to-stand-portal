'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { leadConvertedEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, contacts, contactClients, leads, users } from '@/lib/db/schema'
import { createClient } from '@/lib/settings/clients/actions/create-client'
import { saveProject } from '@/lib/settings/projects/actions/save-project'
import { extractLeadNotes } from '@/lib/leads/notes'
import { leadConversionSchema, type LeadConversionFormValues } from '../conversion-schema'
import type { LeadConversionResult } from '../conversion-types'

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

  let finalClientId: string
  let finalClientSlug: string | undefined
  const warnings: string[] = []

  // D16 + W12: `createClient` calls `assertClientPartnerUserRoles`, which ERRORS
  // OUT when the referenced user is archived — so copying an archived assignee
  // straight through would abort the whole conversion over a field the user
  // never touched. Resolve the attribution defensively first: an archived or
  // non-ADMIN reference becomes null plus a warning, never a failure.
  const attribution = await resolveLeadAttribution(lead, warnings)

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

    // C10: NEVER overwrite an existing client's attribution. These fields feed
    // the monthly-close origination and partner-payout reports, and the existing
    // client's values may already have fed a closed month. Fill only nulls, and
    // say so when something was skipped.
    await applyAttributionToExistingClient(
      existingClient.id,
      attribution,
      warnings
    )
  } else {
    // 2b. Create a new client (reuse existing action)
    const resolvedName = clientName || lead.companyName || lead.contactName
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
        website: lead.companyWebsite || null,
        originationContactId: attribution.originationContactId,
        originationUserId: attribution.originationUserId,
        // D16: the person working the lead is the person who closed it.
        closerUserId: attribution.closerUserId,
        notes: resolvedNotes,
        memberIds: memberIds || [],
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

  // 3. Create a contact from lead info (if requested and lead has an email)
  const contactEmail = lead.contactEmail
  if (createContact && contactEmail) {
    try {
      // Check if contact already exists with this email
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.email, contactEmail), isNull(contacts.deletedAt)))
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

      if (!existingLink) {
        await db.insert(contactClients).values({
          contactId,
          clientId: finalClientId,
          isPrimary: true,
        })
      }
    } catch (err) {
      console.error('[convert-lead] Failed to create contact:', err)
      warnings.push('Contact record could not be created. You can add it manually from the client page.')
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
        console.error('[convert-lead] Failed to create project:', projectResult.error)
        warnings.push(`Project could not be created: ${projectResult.error}`)
      } else {
        projectId = projectResult.projectId
      }
    } catch (err) {
      console.error('[convert-lead] Failed to create project:', err)
      warnings.push('Project could not be created. You can create it manually from settings.')
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
  const resolvedName = clientName || lead.companyName || lead.contactName
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
    metadata: event.metadata,
  })

  revalidatePath('/leads')
  revalidatePath('/clients')

  return {
    clientId: finalClientId,
    clientSlug: finalClientSlug,
    projectId,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}


type LeadAttribution = {
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
}

/**
 * Resolve what a converted client should inherit from the lead (D16).
 *
 * `createClient` runs `assertClientPartnerUserRoles`, which returns an ERROR —
 * killing the entire conversion — when a referenced user is archived
 * (`deleted_at IS NOT NULL`) or is not an ADMIN. Role is safe by construction
 * (`fetchLeadAssignees` delegates to `fetchAdminUsers`), but archival is not:
 * converting an older lead whose assignee has since been archived would fail
 * with "Selected partner user is archived", about a field the user never
 * touched.
 *
 * So both user references are validated here first. An invalid one becomes null
 * plus a `warnings[]` entry — the conversion succeeds and the operator is told
 * what was dropped (W12).
 */
async function resolveLeadAttribution(
  lead: { originationContactId: string | null; originationUserId: string | null; assigneeId: string | null },
  warnings: string[]
): Promise<LeadAttribution> {
  const candidateIds = [lead.originationUserId, lead.assigneeId].filter(
    (id): id is string => Boolean(id)
  )

  const validUserIds = new Set<string>()

  if (candidateIds.length > 0) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt)))

    for (const row of rows) {
      if (candidateIds.includes(row.id)) {
        validUserIds.add(row.id)
      }
    }
  }

  const originationUserId =
    lead.originationUserId && validUserIds.has(lead.originationUserId)
      ? lead.originationUserId
      : null

  if (lead.originationUserId && !originationUserId) {
    warnings.push(
      'The lead\'s internal origination partner is archived or no longer an admin, so origination was left unset on the client.'
    )
  }

  // An unassigned lead simply yields a null closer — the existing behavior, and
  // not worth a warning.
  const closerUserId =
    lead.assigneeId && validUserIds.has(lead.assigneeId)
      ? lead.assigneeId
      : null

  if (lead.assigneeId && !closerUserId) {
    warnings.push(
      'The lead\'s assignee is archived or no longer an admin, so the closer was left unset on the client.'
    )
  }

  return {
    originationContactId: lead.originationContactId,
    originationUserId,
    closerUserId,
  }
}

/**
 * Fill only the NULL attribution fields on an existing client (C10).
 *
 * `origination_*` and `closer_user_id` feed the monthly-close origination and
 * partner-payout reports. Per the billing-terms/close-locking precedent, a
 * mutable field must not silently change what a historical report reads — so an
 * existing non-null value wins, and the skip is surfaced as a warning rather
 * than happening invisibly.
 */
async function applyAttributionToExistingClient(
  clientId: string,
  attribution: LeadAttribution,
  warnings: string[]
): Promise<void> {
  const [existing] = await db
    .select({
      originationContactId: clients.originationContactId,
      originationUserId: clients.originationUserId,
      closerUserId: clients.closerUserId,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  if (!existing) {
    return
  }

  const updates: Record<string, string> = {}
  const hasOrigination = Boolean(
    existing.originationContactId || existing.originationUserId
  )

  if (attribution.originationContactId || attribution.originationUserId) {
    if (hasOrigination) {
      warnings.push(
        'This client already has an origination set, so the lead\'s origination was not copied.'
      )
    } else if (attribution.originationContactId) {
      updates.originationContactId = attribution.originationContactId
    } else if (attribution.originationUserId) {
      updates.originationUserId = attribution.originationUserId
    }
  }

  if (attribution.closerUserId) {
    if (existing.closerUserId) {
      warnings.push(
        'This client already has a closer set, so the lead\'s assignee was not copied.'
      )
    } else {
      updates.closerUserId = attribution.closerUserId
    }
  }

  if (Object.keys(updates).length === 0) {
    return
  }

  await db
    .update(clients)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(clients.id, clientId))
}
