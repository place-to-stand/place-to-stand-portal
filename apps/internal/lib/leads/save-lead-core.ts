import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import {
  leadCreatedEvent,
  leadStatusChangedEvent,
  leadUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'
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
  type DeferActivity,
} from '@/lib/companies/find-or-create'
import type { ActivitySourceValue } from '@/lib/types'

import {
  diffLeadFields,
  normalizeLeadPayload,
  saveLeadSchema,
  type NormalizedLead,
  type SaveLeadInput,
} from './save-lead-fields'
import {
  SaveRefused,
  resolveLeadCompany,
  resolveLeadContact,
  type SaveContext,
} from './save-lead-party'

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

    // Moving back to an active stage reopens the lead. The conversion
    // record (`convertedAt`, which links the lead to its company as a
    // client) is kept: a Won lead moved back stays converted.
    if (
      isTerminalLeadStatus(existing.status) &&
      !isTerminalLeadStatus(normalized.status)
    ) {
      setPayload.resolvedAt = null
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
