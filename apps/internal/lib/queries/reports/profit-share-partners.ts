import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, inArray, isNull, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export type ProfitSharePartnerUserRow = {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  updatedAt: string
}

/** Active (non-archived) users with the given ids. */
export async function fetchUsersByIds(
  ids: readonly string[]
): Promise<ProfitSharePartnerUserRow[]> {
  if (ids.length === 0) return []

  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: personNameSql,
      avatarUrl: personAvatarSql,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(inArray(users.id, [...ids]), eligiblePartner))
}

/**
 * Who can split the profit share: a live staff sign-in (not archived, not
 * switched off, not a client). The Business page lists, saves and the close
 * pays only these, so all three always agree.
 */
export const eligiblePartner = and(
  isNull(users.deletedAt),
  isNull(users.disabledAt),
  ne(users.role, 'CLIENT')
)
