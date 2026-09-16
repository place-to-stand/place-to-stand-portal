import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import {
  leadCreatedEvent,
  leadStatusChangedEvent,
  leadUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'
import { isTerminalLeadStatus } from '@/lib/leads/constants'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'
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
  assertAdmin(actor)

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

async function createLead(
  actor: AppUser,
  normalized: NormalizedLead,
  source: ActivitySourceValue
): Promise<SaveLeadResult> {
  const timestamp = new Date().toISOString()
  const rank = await resolveNextLeadRank(normalized.status)

  const [inserted] = await db
    .insert(leads)
    .values({
      contactName: normalized.contactName,
      status: normalized.status,
      sourceType: normalized.sourceType,
      sourceDetail: normalized.sourceDetail,
      assigneeId: normalized.assigneeId,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      companyName: normalized.companyName,
      companyWebsite: normalized.companyWebsite,
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
      contactName: leads.contactName,
      status: leads.status,
      sourceType: leads.sourceType,
      sourceDetail: leads.sourceDetail,
      assigneeId: leads.assigneeId,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
      companyName: leads.companyName,
      companyWebsite: leads.companyWebsite,
      notes: leads.notes,
      rank: leads.rank,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!existing) {
    return { success: false, error: 'Lead not found.', notFound: true }
  }

  const statusChanged = existing.status !== normalized.status
  const diff = diffLeadFields(existing, normalized)
  const rank = statusChanged
    ? await resolveNextLeadRank(normalized.status)
    : existing.rank

  const setPayload: Record<string, unknown> = {
    contactName: normalized.contactName,
    status: normalized.status,
    sourceType: normalized.sourceType,
    sourceDetail: normalized.sourceDetail,
    assigneeId: normalized.assigneeId,
    contactEmail: normalized.contactEmail,
    contactPhone: normalized.contactPhone,
    companyName: normalized.companyName,
    companyWebsite: normalized.companyWebsite,
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

  return { success: true, leadId }
}
