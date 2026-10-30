import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import {
  contactCreatedEvent,
  contactUpdatedEvent,
  leadCreatedEvent,
  leadStatusChangedEvent,
  leadUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  clients,
  contactLeads,
  contacts,
  leads,
  leadStageHistory,
} from '@/lib/db/schema'
import { isTerminalLeadStatus } from '@/lib/leads/constants'
import {
  leadCompany,
  leadCompanyJoin,
  leadContact,
  leadContactJoin,
  leadDisplayFields,
} from '@/lib/leads/lead-display'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'
import { notifyLeadAssigned } from '@/lib/notifications/in-app/events'
import {
  fillCompanyWebsiteIfBlank,
  findOrCreateCompanyByName,
  getLinkableCompany,
} from '@/lib/queries/companies'
import { joinCompany, mainCompanyIdSql } from '@/lib/queries/memberships'
import type { ActivitySourceValue } from '@/lib/types'

import {
  diffLeadFields,
  normalizeLeadPayload,
  saveLeadSchema,
  type NormalizedLead,
  type SaveLeadInput,
} from './save-lead-fields'

export type SaveLeadResult = {
  success: boolean
  error?: string
  /** Set on every successful write — created or updated. */
  leadId?: string
  /**
   * Distinguishes "the lead does not exist" from a caller-fixable payload
   * error, so an HTTP caller can map it to 404 rather than 400.
   */
  notFound?: boolean
}

/**
 * The one create-and-update path for leads, with the acting admin injected
 * rather than resolved from a session. Lives outside the `'use server'` module
 * for the same reason `saveTaskForActor` does: an `actor` parameter on a server
 * action would be attacker-controlled. The action resolves the actor from the
 * session cookie, the CLI API from a bearer token.
 *
 * Callers own cache revalidation.
 */
export async function saveLeadForActor(
  actor: AppUser,
  input: SaveLeadInput,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  assertCrmAccess(actor)

  const parsed = saveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead payload.',
    }
  }

  let normalized: NormalizedLead

  try {
    normalized = normalizeLeadPayload(parsed.data)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid lead payload.',
    }
  }

  try {
    return normalized.id
      ? await updateLead(actor, normalized.id, normalized, source)
      : await createLead(actor, normalized, source)
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }
}

/**
 * Which company a save links the lead to. The sheet's picker sends
 * `companyId` (null clears it). The CLI and MCP send a name instead: an
 * unchanged name keeps its link, a new one finds or creates the company, and
 * a blank one clears it.
 */
async function resolveLeadCompany(
  actor: AppUser,
  normalized: NormalizedLead,
  existing?: { companyId: string | null; companyName: string | null }
): Promise<
  { company: { id: string; name: string } | null } | { error: string }
> {
  if (normalized.companyId !== undefined) {
    if (normalized.companyId === null) return { company: null }
    const company = await getLinkableCompany(normalized.companyId)
    return company
      ? { company }
      : { error: 'That company no longer exists. Pick another.' }
  }

  const nameUnchanged =
    (existing?.companyName ?? '').trim().toLowerCase() ===
    (normalized.companyName ?? '').trim().toLowerCase()
  if (existing?.companyId && nameUnchanged) {
    return {
      company: { id: existing.companyId, name: existing.companyName ?? '' },
    }
  }
  return {
    company: await findOrCreateCompanyByName(actor, normalized.companyName, {
      website: normalized.companyWebsite,
    }),
  }
}

type LeadContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

/**
 * Which contact a save links the lead to; the lead reads its name, email and
 * phone from it. The sheet's picker sends `contactId`. The CLI,
 * MCP and intake send contact fields instead: an existing lead edits its
 * linked contact; a new lead links the contact with that email, or a new
 * contact (name-only when there's no email).
 */
async function resolveLeadContact(
  actor: AppUser,
  normalized: NormalizedLead,
  companyId: string | null,
  existing?: { contactId: string | null }
): Promise<{ contact: LeadContact } | { error: string }> {
  const fields = {
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    hasCompany: sql<boolean>`${mainCompanyIdSql(contacts.id)} is not null`,
  }
  const timestamp = new Date().toISOString()

  // A contact with no company joins the lead's. Membership grants no client
  // access (that's switched on per person on the client).
  const linkCompany = async (contact: { id: string; hasCompany: boolean }) => {
    if (!companyId) return
    if (contact.hasCompany) {
      if (!normalized.addContactToCompany) return
      // A client's contacts are admin-only (same rule as the contact sheet).
      if (!roleCan(actor.role, 'clients.manage')) {
        const [client] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(eq(clients.companyId, companyId), isNull(clients.deletedAt))
          )
          .limit(1)
        if (client) return
      }
    }
    await joinCompany(db, contact.id, companyId)
  }

  if (normalized.contactId) {
    const [contact] = await db
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, normalized.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    if (!contact)
      return { error: 'That contact no longer exists. Pick another.' }
    await linkCompany(contact)
    return { contact }
  }

  const email = normalized.contactEmail?.trim().toLowerCase() || null
  const details = {
    name: normalized.contactName,
    email,
    phone: normalized.contactPhone,
  }

  // An existing lead keeps its contact unless the email now names someone
  // else. Name and phone edits update the contact in place (its other leads
  // read it too); an email change relinks the lead instead, so a correction
  // never renames a contact other records share.
  if (existing?.contactId) {
    const [contact] = await db
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, existing.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    const sameEmail =
      (contact?.email ?? '').toLowerCase() === (details.email ?? '')
    if (contact && sameEmail) {
      const changed =
        contact.name !== details.name ||
        (contact.phone ?? null) !== details.phone
      if (changed) {
        await db
          .update(contacts)
          .set({
            name: details.name,
            phone: details.phone,
            updatedAt: timestamp,
          })
          .where(eq(contacts.id, contact.id))
        await logActivity({
          actorId: actor.id,
          actorRole: actor.role,
          targetType: 'CONTACT',
          targetId: contact.id,
          ...contactUpdatedEvent({
            email: contact.email,
            name: details.name,
            changedFields: [
              ...(contact.name !== details.name ? ['name'] : []),
              ...((contact.phone ?? null) !== details.phone ? ['phone'] : []),
            ],
            details: {
              before: { name: contact.name, phone: contact.phone },
              after: { name: details.name, phone: details.phone },
            },
          }),
        })
      }
      await linkCompany(contact)
      return {
        contact: {
          id: contact.id,
          name: details.name,
          // Keep the contact's own spelling of its email.
          email: contact.email,
          phone: details.phone,
        },
      }
    }
  }

  if (email) {
    // Same rule as the 0096 backfill: a live contact wins, then an
    // exact-case match, then the oldest. An archived match is restored,
    // since a live lead now points at them.
    const [match] = await db
      .select({ ...fields, deletedAt: contacts.deletedAt })
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${email}`)
      .orderBy(
        sql`${contacts.deletedAt} is not null`,
        sql`${contacts.email} = ${email} desc`,
        contacts.createdAt
      )
      .limit(1)
    if (match) {
      if (match.deletedAt) {
        await db
          .update(contacts)
          .set({ deletedAt: null, updatedAt: timestamp })
          .where(eq(contacts.id, match.id))
      }
      await linkCompany(match)
      return {
        contact: {
          id: match.id,
          name: match.name,
          email: match.email,
          phone: match.phone,
        },
      }
    }
  }

  const [created] = await db
    .insert(contacts)
    .values({ ...details, createdBy: actor.id })
    .returning({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
  if (!created) return { error: 'Unable to save the contact.' }
  await linkCompany({ id: created.id, hasCompany: false })

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'CONTACT',
    targetId: created.id,
    ...contactCreatedEvent({ email: created.email, name: created.name }),
  })
  return { contact: created }
}

/** Keeps the many-to-many link table in step with `leads.contact_id`. */
async function linkContactToLead(contactId: string, leadId: string) {
  await db
    .insert(contactLeads)
    .values({ contactId, leadId })
    .onConflictDoNothing({
      target: [contactLeads.contactId, contactLeads.leadId],
    })
}

async function createLead(
  actor: AppUser,
  normalized: NormalizedLead,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  const timestamp = new Date().toISOString()
  const rank = await resolveNextLeadRank(normalized.status)
  const resolved = await resolveLeadCompany(actor, normalized)
  if ('error' in resolved) return { success: false, error: resolved.error }
  const { company } = resolved
  if (company) {
    await fillCompanyWebsiteIfBlank(
      actor,
      company.id,
      normalized.companyWebsite
    )
  }
  const contactResult = await resolveLeadContact(
    actor,
    normalized,
    company?.id ?? null
  )
  if ('error' in contactResult)
    return { success: false, error: contactResult.error }
  const { contact } = contactResult

  const [inserted] = await db
    .insert(leads)
    .values({
      contactId: contact.id,
      status: normalized.status,
      sourceType: normalized.sourceType,
      sourceDetail: normalized.sourceDetail,
      assigneeId: normalized.assigneeId,
      companyId: company?.id ?? null,
      notes: serializeLeadNotes(normalized.notes),
      rank,
      currentStageEnteredAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning({ id: leads.id })

  if (!inserted) {
    return { success: false, error: 'Unable to save lead. Please try again.' }
  }
  await linkContactToLead(contact.id, inserted.id)

  await db.insert(leadStageHistory).values({
    leadId: inserted.id,
    fromStatus: null,
    toStatus: normalized.status,
    changedAt: timestamp,
    changedBy: actor.id,
  })

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    source,
    targetType: 'LEAD',
    targetId: inserted.id,
    ...leadCreatedEvent({
      name: normalized.contactName,
      source: normalized.sourceType,
      status: normalized.status,
    }),
  })

  if (normalized.assigneeId) {
    await notifyLeadAssigned(
      actor,
      {
        id: inserted.id,
        contactName: normalized.contactName,
        companyName: normalized.companyName,
      },
      normalized.assigneeId
    )
  }

  return { success: true, leadId: inserted.id }
}

async function updateLead(
  actor: AppUser,
  leadId: string,
  normalized: NormalizedLead,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  const timestamp = new Date().toISOString()

  const [existing] = await db
    .select({
      id: leads.id,
      contactName: leadDisplayFields.contactName,
      status: leads.status,
      sourceType: leads.sourceType,
      sourceDetail: leads.sourceDetail,
      assigneeId: leads.assigneeId,
      contactEmail: leadDisplayFields.contactEmail,
      contactPhone: leadDisplayFields.contactPhone,
      companyName: leadDisplayFields.companyName,
      companyWebsite: leadDisplayFields.companyWebsite,
      companyId: leads.companyId,
      contactId: leads.contactId,
      notes: leads.notes,
      rank: leads.rank,
    })
    .from(leads)
    .innerJoin(leadContact, leadContactJoin)
    .leftJoin(leadCompany, leadCompanyJoin)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!existing) {
    return { success: false, error: 'Lead not found.', notFound: true }
  }

  const resolved = await resolveLeadCompany(actor, normalized, existing)
  if ('error' in resolved) return { success: false, error: resolved.error }
  const { company } = resolved
  if (company) {
    await fillCompanyWebsiteIfBlank(
      actor,
      company.id,
      normalized.companyWebsite
    )
  }
  // Always store the company's own spelling, so a case-only edit can't
  // drift from the linked record.
  if (company) {
    normalized = { ...normalized, companyName: company.name }
  }
  const contactResult = await resolveLeadContact(
    actor,
    normalized,
    company?.id ?? null,
    existing
  )
  if ('error' in contactResult)
    return { success: false, error: contactResult.error }
  const { contact } = contactResult
  // The lead shows its contact's details. The website belongs to the
  // company (filled above only when it had none), so it isn't a lead change.
  normalized = {
    ...normalized,
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    companyWebsite: undefined,
  }

  const statusChanged = existing.status !== normalized.status
  const diff = diffLeadFields(existing, normalized)
  const rank = statusChanged
    ? await resolveNextLeadRank(normalized.status)
    : existing.rank

  const setPayload: Record<string, unknown> = {
    contactId: contact.id,
    status: normalized.status,
    sourceType: normalized.sourceType,
    sourceDetail: normalized.sourceDetail,
    assigneeId: normalized.assigneeId,
    companyId: company?.id ?? null,
    notes: serializeLeadNotes(normalized.notes),
    rank,
    updatedAt: timestamp,
  }

  if (statusChanged) {
    setPayload.currentStageEnteredAt = timestamp

    if (isTerminalLeadStatus(normalized.status)) {
      setPayload.resolvedAt = timestamp
    }

    // Reset conversion/resolution fields when moving back to an active stage
    if (
      isTerminalLeadStatus(existing.status) &&
      !isTerminalLeadStatus(normalized.status)
    ) {
      setPayload.resolvedAt = null
      setPayload.convertedAt = null
      setPayload.convertedToClientId = null
      setPayload.lossReason = null
      setPayload.lossNotes = null
    }
  }

  await db.update(leads).set(setPayload).where(eq(leads.id, leadId))

  if (statusChanged) {
    await db.insert(leadStageHistory).values({
      leadId,
      fromStatus: existing.status,
      toStatus: normalized.status,
      changedAt: timestamp,
      changedBy: actor.id,
    })
  }

  // Status-only edits read as a stage move; anything else is a field diff
  // that carries status inside it when both changed. A no-op save logs
  // nothing.
  if (diff.changedFields.length === 1 && statusChanged) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadStatusChangedEvent({
        name: normalized.contactName,
        fromStatus: existing.status,
        toStatus: normalized.status,
      }),
    })
  } else if (diff.changedFields.length > 0) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadUpdatedEvent({
        name: normalized.contactName,
        changedFields: diff.changedFields,
        details: { before: diff.before, after: diff.after },
      }),
    })
  }

  await linkContactToLead(contact.id, leadId)
  if (existing.contactId && existing.contactId !== contact.id) {
    // The lead moved to another contact: drop the old link.
    await db
      .delete(contactLeads)
      .where(
        and(
          eq(contactLeads.contactId, existing.contactId),
          eq(contactLeads.leadId, leadId)
        )
      )
  }

  if (normalized.assigneeId && normalized.assigneeId !== existing.assigneeId) {
    await notifyLeadAssigned(
      actor,
      {
        id: leadId,
        contactName: normalized.contactName,
        companyName: normalized.companyName,
      },
      normalized.assigneeId
    )
  }

  return { success: true, leadId }
}
