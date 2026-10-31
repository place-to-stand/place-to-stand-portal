import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, gt, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { userRoleTerms, users } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'

import { fetchLastSignIns } from './settings'

/** What a contact's sheet shows about the portal user it was promoted to. */
export type PortalAccountSummary = {
  id: string
  fullName: string | null
  email: string
  role: 'ADMIN' | 'SALES' | 'CLIENT'
  avatarUrl: string | null
  createdAt: string
  disabledAt: string | null
  deletedAt: string | null
  lastSignInAt: string | null
  /** A role change dated after this month, still to come. */
  scheduledRole: { role: 'ADMIN' | 'SALES' | 'CLIENT'; effectiveFrom: string } | null
}

/**
 * The portal account behind a contact (`contacts.user_id`). Archived users
 * are returned, not hidden — the contact still points at them, and the sheet
 * should say so rather than claim there is no account.
 */
export async function getPortalAccountSummary(
  actor: AppUser,
  userId: string
): Promise<PortalAccountSummary | null> {
  assertAdmin(actor)

  const [[row], lastSignIns, [scheduled]] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: personNameSql,
        email: users.email,
        role: users.role,
        avatarUrl: personAvatarSql,
        createdAt: users.createdAt,
        disabledAt: users.disabledAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    fetchLastSignIns([userId]),
    db
      .select({ role: userRoleTerms.role, effectiveFrom: userRoleTerms.effectiveFrom })
      .from(userRoleTerms)
      .where(
        and(
          eq(userRoleTerms.userId, userId),
          isNull(userRoleTerms.deletedAt),
          gt(userRoleTerms.effectiveFrom, currentMonthStartUtc())
        )
      )
      .orderBy(asc(userRoleTerms.effectiveFrom))
      .limit(1),
  ])

  if (!row) {
    return null
  }

  return {
    ...row,
    lastSignInAt: lastSignIns.get(userId) ?? null,
    scheduledRole: scheduled ?? null,
  }
}
