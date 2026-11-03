import 'server-only'

import { cache } from 'react'

import { and, asc, inArray, isNull, type SQL } from 'drizzle-orm'
import { personNameSql } from '@pts/db/names'

import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'
import { userFields } from '@/lib/queries/users/fields'
import type { DbUser } from '@/lib/types'

type StaffRole = 'ADMIN' | 'SALES'

/**
 * Live (not archived) sign-ins with one of `roles`, by name then email.
 * `activeOnly` also leaves out disabled sign-ins.
 */
export async function fetchStaffUsers({
  roles,
  activeOnly = false,
}: {
  roles: StaffRole[]
  activeOnly?: boolean
}): Promise<DbUser[]> {
  const conditions: SQL[] = [
    inArray(usersTable.role, roles),
    isNull(usersTable.deletedAt),
  ]
  if (activeOnly) conditions.push(isNull(usersTable.disabledAt))

  const rows = await db
    .select(userFields)
    .from(usersTable)
    .where(and(...conditions))
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
}

export const fetchAdminUsers = cache((): Promise<DbUser[]> =>
  fetchStaffUsers({ roles: ['ADMIN'] })
)

/**
 * Staff who can work leads: admins plus SALES-role CRM staff. Used for lead
 * assignee pickers; everything else that lists staff stays admin-only.
 */
export const fetchCrmUsers = cache((): Promise<DbUser[]> =>
  fetchStaffUsers({ roles: ['ADMIN', 'SALES'] })
)
