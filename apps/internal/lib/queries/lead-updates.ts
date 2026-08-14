import 'server-only'

import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates, users } from '@/lib/db/schema'
import type { LeadUpdateRecord } from '@/lib/leads/types'
import { LEAD_TOUCH_TYPES } from '@/lib/leads/updates'

/**
 * Timeline rows for one lead, newest first, with author identity joined.
 *
 * Admin-asserted like `listTasksForLead` — leads are admin-only data and this
 * project has no RLS backstop (W26).
 */
export async function listLeadUpdates(
  user: AppUser,
  leadId: string
): Promise<LeadUpdateRecord[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: leadUpdates.id,
      leadId: leadUpdates.leadId,
      type: leadUpdates.type,
      body: leadUpdates.body,
      occurredAt: leadUpdates.occurredAt,
      authorId: leadUpdates.authorId,
      authorName: users.fullName,
      authorEmail: users.email,
      authorAvatarUrl: users.avatarUrl,
      createdAt: leadUpdates.createdAt,
      updatedAt: leadUpdates.updatedAt,
    })
    .from(leadUpdates)
    .leftJoin(users, eq(users.id, leadUpdates.authorId))
    .where(and(eq(leadUpdates.leadId, leadId), isNull(leadUpdates.deletedAt)))
    .orderBy(desc(leadUpdates.occurredAt), desc(leadUpdates.createdAt))

  return rows.map(row => ({
    ...row,
    authorName: row.authorName ?? null,
    authorEmail: row.authorEmail ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
  }))
}

/**
 * Derived last-touch per lead — `MAX(occurred_at)` over touch-type updates.
 *
 * Takes an ARRAY of ids, not one id (C4). `lastTouchAt` lives on the shared
 * `LeadRecord`, which the board hydrates for every lead across seven columns, so
 * a per-lead call would be an N+1 on the section's highest-traffic page — even
 * though the card itself doesn't display the value (W11).
 *
 * `NOTE` is excluded via `LEAD_TOUCH_TYPES`, which is the single source of that
 * exclusion (C5) — never re-list the literals here.
 *
 * Leads with no touches are simply absent from the map.
 */
export async function fetchLastTouchByLead(
  user: AppUser,
  leadIds: string[]
): Promise<Map<string, string>> {
  assertAdmin(user)

  if (leadIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      leadId: leadUpdates.leadId,
      lastTouchAt: max(leadUpdates.occurredAt),
    })
    .from(leadUpdates)
    .where(
      and(
        inArray(leadUpdates.leadId, leadIds),
        inArray(leadUpdates.type, [...LEAD_TOUCH_TYPES]),
        isNull(leadUpdates.deletedAt)
      )
    )
    .groupBy(leadUpdates.leadId)

  return new Map(
    rows.flatMap(row => (row.lastTouchAt ? [[row.leadId, row.lastTouchAt]] : []))
  )
}

/**
 * One update row, used by the edit/delete actions to verify ownership before
 * writing. Returns null when the update doesn't exist, is soft-deleted, or
 * belongs to a different lead — the caller must not trust the id alone.
 */
export async function getLeadUpdateForLead(
  updateId: string,
  leadId: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: leadUpdates.id })
    .from(leadUpdates)
    .where(
      and(
        eq(leadUpdates.id, updateId),
        eq(leadUpdates.leadId, leadId),
        isNull(leadUpdates.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}
