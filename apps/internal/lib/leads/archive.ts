import 'server-only'

import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import { leadArchivedEvent, leadRestoredEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { leadContactNameSql } from '@/lib/leads/lead-display'

/**
 * Archives or restores a lead (CRM staff), for the lead sheet, the archive
 * tab and MCP. Throws NotFoundError when there is no such live (or, to
 * restore, archived) lead; callers refresh the lead pages.
 */
export async function setLeadArchived(
  user: AppUser,
  leadId: string,
  archived: boolean
) {
  assertCrmAccess(user)

  const [row] = await db
    .update(leads)
    .set({ deletedAt: archived ? new Date().toISOString() : null })
    .where(
      and(
        eq(leads.id, leadId),
        archived ? isNull(leads.deletedAt) : isNotNull(leads.deletedAt)
      )
    )
    .returning({ id: leads.id, contactName: leadContactNameSql })

  if (!row) {
    throw new NotFoundError(
      archived ? 'Lead not found.' : 'Lead not found in archive.'
    )
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    targetType: 'LEAD',
    targetId: row.id,
    ...(archived ? leadArchivedEvent : leadRestoredEvent)({
      name: row.contactName,
    }),
  })
}
