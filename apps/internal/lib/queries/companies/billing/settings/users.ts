import { personNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function listClientUsers() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: personNameSql,
    })
    .from(users)
    .where(and(eq(users.role, 'CLIENT'), isNull(users.deletedAt)))
    .orderBy(asc(personNameSql), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
  }))
}

