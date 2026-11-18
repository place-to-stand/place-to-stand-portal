import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, inArray, isNull } from 'drizzle-orm'

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
    .where(and(inArray(users.id, [...ids]), isNull(users.deletedAt)))
}
