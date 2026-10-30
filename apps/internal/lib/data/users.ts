import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'
import type { DbUser } from '@/lib/types'

export const fetchAdminUsers = cache(async (): Promise<DbUser[]> => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: personNameSql,
      role: usersTable.role,
      avatarUrl: personAvatarSql,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      deletedAt: usersTable.deletedAt,
      disabledAt: usersTable.disabledAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.role, 'ADMIN'), isNull(usersTable.deletedAt)))
    .orderBy(asc(personNameSql), asc(usersTable.email))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    avatar_url: row.avatarUrl,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    disabled_at: row.disabledAt,
  }))
})

/**
 * Staff who can work leads: admins plus SALES-role CRM staff. Used for lead
 * assignee pickers; everything else that lists staff stays admin-only.
 */
export const fetchCrmUsers = cache(async (): Promise<DbUser[]> => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: personNameSql,
      role: usersTable.role,
      avatarUrl: personAvatarSql,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      deletedAt: usersTable.deletedAt,
      disabledAt: usersTable.disabledAt,
    })
    .from(usersTable)
    .where(
      and(
        inArray(usersTable.role, ['ADMIN', 'SALES']),
        isNull(usersTable.deletedAt)
      )
    )
    .orderBy(asc(personNameSql), asc(usersTable.email))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    avatar_url: row.avatarUrl,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    disabled_at: row.disabledAt,
  }))
})
