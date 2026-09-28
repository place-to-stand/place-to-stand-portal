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

/** Active (non-archived) users matching the given emails. */
export async function fetchUsersByEmail(
  emails: readonly string[]
): Promise<ProfitSharePartnerUserRow[]> {
  if (emails.length === 0) return []

  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(inArray(users.email, [...emails]), isNull(users.deletedAt)))
}
