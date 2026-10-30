'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { leadStatusChangedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireCrmUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'
import { leadContactNameSql } from '@/lib/leads/lead-display'
import {
  LEAD_STATUS_VALUES,
  isTerminalLeadStatus,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'
import { normalizeRank } from '@/lib/rank'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const moveLeadSchema = z.object({
  leadId: z.string().uuid(),
  targetStatus: z.enum(LEAD_STATUS_VALUES),
  rank: z.string().min(1, 'Rank is required'),
})

export type MoveLeadInput = z.infer<typeof moveLeadSchema>

type MoveOutcome =
  | { refused: string }
  | {
      refused: null
      statusChange: { contactName: string; fromStatus: LeadStatusValue } | null
    }

export async function moveLead(
  input: MoveLeadInput
): Promise<LeadActionResult> {
  const user = await requireCrmUser()
  assertCrmAccess(user)

  const parsed = moveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  let normalizedRank: string

  try {
    normalizedRank = normalizeRank(parsed.data.rank)
  } catch (error) {
    console.error('Invalid rank provided for lead reorder', error)
    return {
      success: false,
      error: 'Unable to reorder lead with invalid rank.',
    }
  }

  const { leadId, targetStatus } = parsed.data
  let outcome: MoveOutcome

  try {
    // The read, the move and its stage history are one transaction; the
    // activity row waits for the commit.
    outcome = await db.transaction(async (tx): Promise<MoveOutcome> => {
      const [current] = await tx
        .select({
          status: leads.status,
          companyId: leads.companyId,
          convertedAt: leads.convertedAt,
          contactName: leadContactNameSql,
        })
        .from(leads)
        .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
        .limit(1)
        .for('update', { of: leads })

      if (!current) {
        return { refused: 'Lead not found.' }
      }

      // Decision 7: Won needs a company. The board reverts the card.
      if (
        breaksWonNeedsCompany(
          { status: targetStatus, companyId: current.companyId },
          current
        )
      ) {
        return { refused: LEAD_WON_NEEDS_COMPANY_MESSAGE }
      }

      const now = new Date().toISOString()
      const statusChanged = current.status !== targetStatus

      const setPayload: Record<string, unknown> = {
        status: targetStatus,
        rank: normalizedRank,
        updatedAt: now,
      }

      if (statusChanged) {
        setPayload.currentStageEnteredAt = now

        if (isTerminalLeadStatus(targetStatus)) {
          setPayload.resolvedAt = now
        }

        // Only set convertedAt if not already set
        if (targetStatus === 'CLOSED_WON' && !current.convertedAt) {
          setPayload.convertedAt = now
        }

        // Reset conversion/resolution fields when moving back to an active stage
        if (
          isTerminalLeadStatus(current.status) &&
          !isTerminalLeadStatus(targetStatus)
        ) {
          setPayload.resolvedAt = null
          setPayload.convertedAt = null
          setPayload.convertedToClientId = null
          setPayload.lossReason = null
          setPayload.lossNotes = null
        }
      }

      await tx
        .update(leads)
        .set(setPayload)
        .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))

      if (!statusChanged) {
        return { refused: null, statusChange: null }
      }

      await tx.insert(leadStageHistory).values({
        leadId,
        fromStatus: current.status,
        toStatus: targetStatus,
        changedAt: now,
        changedBy: user.id,
      })

      return {
        refused: null,
        statusChange: {
          contactName: current.contactName,
          fromStatus: current.status,
        },
      }
    })
  } catch (error) {
    console.error('Failed to reorder lead', error)
    return {
      success: false,
      error: 'Unable to update lead ordering.',
    }
  }

  if (outcome.refused !== null) {
    return { success: false, error: outcome.refused }
  }

  if (outcome.statusChange) {
    try {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        targetType: 'LEAD',
        targetId: leadId,
        ...leadStatusChangedEvent({
          name: outcome.statusChange.contactName,
          fromStatus: outcome.statusChange.fromStatus,
          toStatus: targetStatus,
        }),
      })
    } catch (error) {
      console.error('Lead moved, but its activity row failed', error)
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
