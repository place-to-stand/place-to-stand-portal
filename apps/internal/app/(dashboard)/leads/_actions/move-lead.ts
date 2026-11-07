'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { leadStatusChangedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireCrmUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { recordLeadStageMove } from '@/lib/leads/record-stage-move'
import { leadStageMoveFields } from '@/lib/leads/stage-rules'
import { leadContactNameSql } from '@/lib/leads/lead-display'
import { LEAD_STATUS_VALUES, type LeadStatusValue } from '@/lib/leads/constants'
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'
import { normalizeRank } from '@/lib/rank'

import { revalidateLeadsPath } from '@/lib/leads/revalidate'
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

      await tx
        .update(leads)
        .set({
          status: targetStatus,
          rank: normalizedRank,
          // A reorder within a column is not an edit: it leaves updated_at
          // alone (migration 0131 ignores rank), so an open lead sheet
          // saves without a conflict.
          ...(statusChanged ? { updatedAt: now } : {}),
          ...leadStageMoveFields(current.status, targetStatus, now),
        })
        .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))

      if (!statusChanged) {
        return { refused: null, statusChange: null }
      }

      // Winning a lead converts it only when its company is already a
      // client; otherwise starting the company's billing does
      // (`startClientBillingInTx`, admin-only).
      await recordLeadStageMove(tx, {
        leadId,
        fromStatus: current.status,
        toStatus: targetStatus,
        at: now,
        actorId: user.id,
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
