import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { leadUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { loadLeadAssigneeOptions } from '@/lib/assignees/options'
import type { SetAssigneeResult } from '@/lib/assignees/types'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import {
  leadCompany,
  leadCompanyJoin,
  leadContact,
  leadContactJoin,
  leadDisplayFields,
} from '@/lib/leads/lead-display'
import { notifyLeadAssigned } from '@/lib/notifications/in-app/events'
import type { ActivitySourceValue } from '@/lib/types'

/**
 * Sets or clears a lead's assignee, and nothing else (the right-click
 * menu's "Set assignee"). Same activity row and notification as a sheet
 * save that only changes the assignee.
 */
export async function setLeadAssigneeForActor(
  actor: AppUser,
  leadId: string,
  assigneeId: string | null,
  source: ActivitySourceValue
): Promise<SetAssigneeResult> {
  assertCrmAccess(actor)

  // Only people the lead picker offers: live, enabled admins and Sales.
  if (assigneeId) {
    const options = await loadLeadAssigneeOptions()
    if (!options.some(option => option.id === assigneeId)) {
      return { ok: false, error: "That person can't be assigned leads." }
    }
  }

  type Outcome =
    | { found: false }
    | {
        found: true
        previousId: string | null
        contactName: string
        companyName: string | null
      }

  let outcome: Outcome
  try {
    outcome = await db.transaction(async (tx): Promise<Outcome> => {
      const [existing] = await tx
        .select({
          assigneeId: leads.assigneeId,
          contactName: leadDisplayFields.contactName,
          companyName: leadDisplayFields.companyName,
        })
        .from(leads)
        .innerJoin(leadContact, leadContactJoin)
        .leftJoin(leadCompany, leadCompanyJoin)
        .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
        .limit(1)
        .for('update', { of: leads })

      if (!existing) return { found: false }

      if (existing.assigneeId !== assigneeId) {
        await tx
          .update(leads)
          .set({ assigneeId, updatedAt: new Date().toISOString() })
          .where(eq(leads.id, leadId))
      }

      return {
        found: true,
        previousId: existing.assigneeId,
        contactName: existing.contactName,
        companyName: existing.companyName,
      }
    })
  } catch (error) {
    console.error('Failed to set lead assignee', error)
    return { ok: false, error: 'Unable to update lead.' }
  }

  if (!outcome.found) {
    return { ok: false, error: 'Lead not found.' }
  }

  if (outcome.previousId !== assigneeId) {
    // Committed. Side effects log their own failures.
    try {
      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        source,
        targetType: 'LEAD',
        targetId: leadId,
        ...leadUpdatedEvent({
          name: outcome.contactName,
          changedFields: ['assignee'],
          details: {
            before: { assigneeId: outcome.previousId },
            after: { assigneeId },
          },
        }),
      })
    } catch (error) {
      console.error('Lead assignee set, but its activity row failed', error)
    }
    if (assigneeId) {
      await notifyLeadAssigned(
        actor,
        {
          id: leadId,
          contactName: outcome.contactName,
          companyName: outcome.companyName,
        },
        assigneeId
      )
    }
  }

  return { ok: true }
}
