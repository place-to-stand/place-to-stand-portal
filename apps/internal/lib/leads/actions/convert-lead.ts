'use server'

import { and, eq, getTableColumns, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { leadConvertedEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, companies, leads, memberships } from '@/lib/db/schema'
import { createClient } from '@/lib/settings/clients/actions/create-client'
import { saveProject } from '@/lib/settings/projects/actions/save-project'
import { extractLeadNotes } from '@/lib/leads/notes'
import {
  leadConversionSchema,
  type LeadConversionFormValues,
} from '../conversion-schema'
import type { LeadConversionResult } from '../conversion-types'
import { getLinkableCompany } from '@/lib/queries/companies'
import {
  joinCompany,
  setCompanyPrimary,
  setPortalAccess,
} from '@/lib/queries/memberships'
import {
  leadCompany as leadCompanyTable,
  leadCompanyJoin,
  leadContact,
  leadContactJoin,
  leadDisplayFields,
} from '../lead-display'

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
    givePortalAccess,
    createProject,
    projectName,
    existingClientId,
  } = parsed.data

  // 1. Fetch the lead
  const [lead] = await db
    .select({
      ...getTableColumns(leads),
      ...leadDisplayFields,
      contactDeletedAt: leadContact.deletedAt,
    })
    .from(leads)
    .innerJoin(leadContact, leadContactJoin)
    .leftJoin(leadCompanyTable, leadCompanyJoin)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { error: 'Lead not found.' }
  }

  if (lead.deletedAt) {
    return { error: 'This lead is archived. Restore it before converting.' }
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

  // A company has one billing record: when the lead's company is already a
  // client, Make client links the lead to it instead of making another.
  const [companyClient] = leadCompanyId
    ? await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.companyId, leadCompanyId), isNull(clients.deletedAt))
        )
        .limit(1)
    : []
  const linkClientId = existingClientId ?? companyClient?.id

  if (linkClientId) {
    // 2a. Link to existing client
    const [existingClient] = await db
      .select({ id: clients.id, slug: clients.slug })
      .from(clients)
      .where(and(eq(clients.id, linkClientId), isNull(clients.deletedAt)))
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
        // The company owns the website.
        website: leadCompanyWebsite,
        originationContactId: null,
        originationUserId: null,
        closers: [],
        notes: resolvedNotes,
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

  // 3. Winning the lead is the one deliberate step that puts its contact on
  // the client: they join the client's company (keeping any others), get
  // portal access, and become its primary contact when it has none.
  const warnings: string[] = []
  // The lead's person joins the client's company (keeping any others) and
  // becomes its primary contact if it has none. Portal access only when
  // asked for.
  {
    try {
      const [client] = await db
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, finalClientId))
        .limit(1)
      const clientCompanyId = client?.companyId ?? null
      if (lead.contactDeletedAt) {
        if (givePortalAccess) {
          warnings.push(
            `${lead.contactName} is archived, so they weren’t given portal access. Restore them first.`
          )
        }
      } else if (!clientCompanyId) {
        if (givePortalAccess) {
          warnings.push(
            `This client has no company, so ${lead.contactName} wasn’t given portal access. Link a company first.`
          )
        }
      } else {
        await db.transaction(async tx => {
          await joinCompany(tx, lead.contactId, clientCompanyId)
          if (givePortalAccess) {
            const granted = await setPortalAccess(
              tx,
              lead.contactId,
              clientCompanyId,
              true
            )
            // Access needs a portal login; the contact sheet creates one.
            if (!granted) {
              warnings.push(
                `${lead.contactName} has no portal user yet, so they weren’t given portal access. Create one from their contact, then switch it on in Edit client > Portal access.`
              )
            }
          }
          const [primary] = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.companyId, clientCompanyId),
                eq(memberships.isPrimary, true),
                isNull(memberships.endedAt)
              )
            )
            .limit(1)
          if (!primary) {
            await setCompanyPrimary(tx, clientCompanyId, lead.contactId)
          }
        })
      }
    } catch (err) {
      console.error(
        '[convert-lead] Failed to add the contact to the client:',
        err
      )
      warnings.push(
        givePortalAccess
          ? 'The contact could not be added to the client’s company or given portal access. You can do it from the client.'
          : 'The contact could not be added to the client’s company. You can add them from the company.'
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

  // 5. Update the lead with conversion info, only if nobody converted or
  // archived it while this ran (two people converting at once).
  const [claimed] = await db
    .update(leads)
    .set({
      convertedAt: new Date().toISOString(),
      convertedToClientId: finalClientId,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(leads.id, leadId),
        isNull(leads.convertedToClientId),
        isNull(leads.deletedAt)
      )
    )
    .returning({ id: leads.id })

  if (!claimed) {
    revalidatePath('/leads')
    revalidatePath('/clients')
    return {
      error: linkClientId
        ? 'This lead was converted or archived while you were converting it.'
        : 'This lead was converted or archived while you were converting it. Check its company for a client to stop billing.',
    }
  }

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
