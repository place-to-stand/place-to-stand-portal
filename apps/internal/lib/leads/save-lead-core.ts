import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import {
  contactCreatedEvent,
  contactRestoredEvent,
  contactUpdatedEvent,
  leadCreatedEvent,
  leadStatusChangedEvent,
  leadUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { roleCan } from '@/lib/auth/capabilities'
import { isAdminRole } from '@/lib/auth/roles'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, contacts, leads, leadStageHistory } from '@/lib/db/schema'
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
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'
import { notifyLeadAssigned } from '@/lib/notifications/in-app/events'
import {
  fillCompanyWebsiteIfBlank,
  findOrCreateCompanyByName,
  getLinkableCompany,
  type DeferActivity,
} from '@/lib/queries/companies'
import {
  atClientCompanySql,
  joinCompany,
  mainCompanyIdSql,
} from '@/lib/queries/memberships'
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

  // One transaction: the company, the person, the lead and its stage history
  // all land, or none do. Activity rows and notifications wait for the commit
  // so a refused or failed save leaves no trace.
  const afterCommit: Array<() => Promise<unknown>> = []
  const defer: DeferActivity = task => {
    afterCommit.push(task)
  }

  let result: SaveLeadResult
  try {
    result = await db.transaction(async tx => {
      const ctx: SaveContext = { tx, actor, defer }
      const saved = normalized.id
        ? await updateLead(ctx, normalized.id, normalized, source)
        : await createLead(ctx, normalized, source)
      // A refusal after a write (a company made, then a missing person) must
      // undo that write too.
      if (!saved.success) throw new SaveRefused(saved)
      return saved
    })
  } catch (error) {
    if (error instanceof SaveRefused) return error.result
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }

  for (const task of afterCommit) {
    try {
      await task()
    } catch (error) {
      // The save committed; a failed side effect must not report it failed.
      console.error('Lead saved, but a follow-up write failed', error)
    }
  }
  return result
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type SaveContext = {
  tx: Tx
  actor: AppUser
  /** Runs after commit: activity rows and notifications. */
  defer: DeferActivity
}

/** Rolls the transaction back and carries the refusal out of it. */
class SaveRefused extends Error {
  constructor(readonly result: SaveLeadResult) {
    super(result.error ?? 'Lead save refused')
  }
}

/**
 * Which company a save links the lead to. The sheet's picker sends
 * `companyId` (null clears it). The CLI and MCP send a name instead: an
 * unchanged name keeps its link, a new one finds or creates the company, and
 * a blank one clears it.
 */
async function resolveLeadCompany(
  { tx, actor, defer }: SaveContext,
  normalized: NormalizedLead,
  existing?: { companyId: string | null; companyName: string | null }
): Promise<
  { company: { id: string; name: string } | null } | { error: string }
> {
  if (normalized.companyId !== undefined) {
    if (normalized.companyId === null) return { company: null }
    const company = await getLinkableCompany(normalized.companyId, tx)
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
      executor: tx,
      defer,
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
  { tx, actor, defer }: SaveContext,
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
    userId: contacts.userId,
    atClient: atClientCompanySql(contacts.id),
  }
  const timestamp = new Date().toISOString()
  const isAdmin = isAdminRole(actor.role)
  const canManageClients = roleCan(actor.role, 'clients.manage')
  // Someone who can sign in is edited by admins only (their companies decide
  // what they can see), and a client's people need `clients.manage`, as on
  // the person sheet. A lead save still links them; it just leaves them be.
  const isLocked = (contact: { userId: string | null; atClient: boolean }) =>
    (Boolean(contact.userId) && !isAdmin) ||
    (contact.atClient && !canManageClients)

  // A contact with no company joins the lead's. Membership grants no client
  // access (that's switched on per person on the client).
  const linkCompany = async (contact: {
    id: string
    hasCompany: boolean
    userId: string | null
  }) => {
    if (!companyId) return
    if (contact.userId && !isAdmin) return
    if (contact.hasCompany) {
      if (!normalized.addContactToCompany) return
      // A client's contacts are admin-only (same rule as the contact sheet).
      if (!roleCan(actor.role, 'clients.manage')) {
        const [client] = await tx
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(
              wasClientCompany(),
              and(eq(companies.id, companyId), isNull(clientEndedAtSql))
            )
          )
          .limit(1)
        if (client) return
      }
    }
    await joinCompany(tx, contact.id, companyId)
  }

  if (normalized.contactId) {
    const [contact] = await tx
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, normalized.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    if (!contact)
      return { error: 'That person no longer exists. Pick another.' }
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
    const [contact] = await tx
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, existing.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    const sameEmail =
      (contact?.email ?? '').toLowerCase() === (details.email ?? '')
    if (contact && sameEmail) {
      const locked = isLocked(contact)
      const changed =
        !locked &&
        (contact.name !== details.name ||
          (contact.phone ?? null) !== details.phone)
      if (changed) {
        await tx
          .update(contacts)
          .set({
            name: details.name,
            phone: details.phone,
            updatedAt: timestamp,
          })
          .where(eq(contacts.id, contact.id))
        const event = contactUpdatedEvent({
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
        })
        defer(() =>
          logActivity({
            actorId: actor.id,
            actorRole: actor.role,
            targetType: 'CONTACT',
            targetId: contact.id,
            ...event,
          })
        )
      }
      await linkCompany(contact)
      return {
        contact: {
          id: contact.id,
          name: locked ? contact.name : details.name,
          // Keep the contact's own spelling of its email.
          email: contact.email,
          phone: locked ? contact.phone : details.phone,
        },
      }
    }
  }

  if (email) {
    // Same rule as the 0096 backfill: a live contact wins, then an
    // exact-case match, then the oldest. An archived match is restored,
    // since a live lead now points at them.
    const [match] = await tx
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
        // Restoring someone who can sign in is admin-only (as on the
        // person sheet).
        if (match.userId && !isAdmin) {
          return {
            error:
              'That email belongs to an archived person who can sign in. Ask an admin to restore them.',
          }
        }
        await tx
          .update(contacts)
          .set({ deletedAt: null, updatedAt: timestamp })
          .where(eq(contacts.id, match.id))
        defer(() =>
          logActivity({
            actorId: actor.id,
            actorRole: actor.role,
            targetType: 'CONTACT',
            targetId: match.id,
            ...contactRestoredEvent({ email: match.email, name: match.name }),
          })
        )
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

  const [created] = await tx
    .insert(contacts)
    .values({ ...details, createdBy: actor.id })
    .returning({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
  if (!created) return { error: 'Unable to save the person.' }
  await linkCompany({ id: created.id, hasCompany: false, userId: null })

  defer(() =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'CONTACT',
      targetId: created.id,
      ...contactCreatedEvent({ email: created.email, name: created.name }),
    })
  )
  return { contact: created }
}

async function createLead(
  ctx: SaveContext,
  normalized: NormalizedLead,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  const { tx, actor, defer } = ctx
  const timestamp = new Date().toISOString()
  const rank = await resolveNextLeadRank(normalized.status, tx)
  const resolved = await resolveLeadCompany(ctx, normalized)
  if ('error' in resolved) return { success: false, error: resolved.error }
  const { company } = resolved
  if (
    breaksWonNeedsCompany({
      status: normalized.status,
      companyId: company?.id,
    })
  ) {
    return { success: false, error: LEAD_WON_NEEDS_COMPANY_MESSAGE }
  }
  if (company) {
    await fillCompanyWebsiteIfBlank(
      actor,
      company.id,
      normalized.companyWebsite,
      { executor: tx, defer }
    )
  }
  const contactResult = await resolveLeadContact(
    ctx,
    normalized,
    company?.id ?? null
  )
  if ('error' in contactResult)
    return { success: false, error: contactResult.error }
  const { contact } = contactResult

  const [inserted] = await tx
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

  await tx.insert(leadStageHistory).values({
    leadId: inserted.id,
    fromStatus: null,
    toStatus: normalized.status,
    changedAt: timestamp,
    changedBy: actor.id,
  })

  const leadId = inserted.id
  defer(() =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadCreatedEvent({
        name: normalized.contactName,
        source: normalized.sourceType,
        status: normalized.status,
      }),
    })
  )

  const assigneeId = normalized.assigneeId
  if (assigneeId) {
    const notice = {
      id: leadId,
      contactName: normalized.contactName,
      companyName: normalized.companyName,
    }
    defer(() => notifyLeadAssigned(actor, notice, assigneeId))
  }

  return { success: true, leadId: inserted.id }
}

async function updateLead(
  ctx: SaveContext,
  leadId: string,
  normalized: NormalizedLead,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  const { tx, actor, defer } = ctx
  const timestamp = new Date().toISOString()

  // Locks the lead row, so two saves of one lead can't both read the old
  // status and each write a stage-history row.
  const [existing] = await tx
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
    .for('update', { of: leads })

  if (!existing) {
    return { success: false, error: 'Lead not found.', notFound: true }
  }

  const resolved = await resolveLeadCompany(ctx, normalized, existing)
  if ('error' in resolved) return { success: false, error: resolved.error }
  const { company } = resolved
  if (
    breaksWonNeedsCompany(
      { status: normalized.status, companyId: company?.id },
      existing
    )
  ) {
    return { success: false, error: LEAD_WON_NEEDS_COMPANY_MESSAGE }
  }
  if (company) {
    await fillCompanyWebsiteIfBlank(
      actor,
      company.id,
      normalized.companyWebsite,
      { executor: tx, defer }
    )
  }
  // Always store the company's own spelling, so a case-only edit can't
  // drift from the linked record.
  if (company) {
    normalized = { ...normalized, companyName: company.name }
  }
  const contactResult = await resolveLeadContact(
    ctx,
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
    ? await resolveNextLeadRank(normalized.status, tx)
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
      setPayload.lossReason = null
      setPayload.lossNotes = null
    }
  }

  await tx.update(leads).set(setPayload).where(eq(leads.id, leadId))

  if (statusChanged) {
    await tx.insert(leadStageHistory).values({
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
    const event = leadStatusChangedEvent({
      name: normalized.contactName,
      fromStatus: existing.status,
      toStatus: normalized.status,
    })
    defer(() =>
      logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        source,
        targetType: 'LEAD',
        targetId: leadId,
        ...event,
      })
    )
  } else if (diff.changedFields.length > 0) {
    const event = leadUpdatedEvent({
      name: normalized.contactName,
      changedFields: diff.changedFields,
      details: { before: diff.before, after: diff.after },
    })
    defer(() =>
      logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        source,
        targetType: 'LEAD',
        targetId: leadId,
        ...event,
      })
    )
  }

  const assigneeId = normalized.assigneeId
  if (assigneeId && assigneeId !== existing.assigneeId) {
    const notice = {
      id: leadId,
      contactName: normalized.contactName,
      companyName: normalized.companyName,
    }
    defer(() => notifyLeadAssigned(actor, notice, assigneeId))
  }

  return { success: true, leadId }
}
