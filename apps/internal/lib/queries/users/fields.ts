import { personNameSql } from '@pts/db/names'
import { sql } from 'drizzle-orm'

import { users } from '@/lib/db/schema'

/** A sign-in row plus the person's name (from their contact). */
export type SelectUser = typeof users.$inferSelect & {
  fullName: string | null
}

export const userFields = {
  id: users.id,
  email: users.email,
  fullName: personNameSql,
  avatarUrl: users.avatarUrl,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
  disabledAt: users.disabledAt,
  onboardingCompletedAt: users.onboardingCompletedAt,
}

export const userSortExpression = sql<string>`
  coalesce(nullif(${personNameSql}, ''), ${users.email}, '')
`

