import {
  clientEndedAtSql,
  clientSinceSql,
  isClientCompany,
} from '@pts/db/client-state'
import { clientNameSql, personAvatarSql, personNameSql } from '@pts/db/names'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'

import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/clients/commission-terms'
import { db } from '@/lib/db'
import {
  clientPortalAccess,
  companies as companiesTable,
  users as usersTable,
} from '@/lib/db/schema'
import type { DbClient, DbUser } from '@/lib/types'

import type { MemberWithUser } from '../types'

export type ClientRelationRow = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  state: string | null
  originationContactId: string | null
  originationUserId: string | null
  billingType: DbClient['billing_type']
  companyId: string
  createdBy: string | null
  /** When it became a client. */
  createdAt: string | null
  updatedAt: string
  deletedAt: string | null
}

export type MemberRow = {
  /** A portal login with access to the client (`client_portal_access`). */
  membership: {
    /** The contact behind the login. */
    id: string
    companyId: string
    userId: string
  }
  user: {
    id: string
    email: string
    fullName: string | null
    role: DbUser['role']
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    disabledAt: string | null
  } | null
}

export async function loadClientRows(
  companyIds: string[]
): Promise<ClientRelationRow[]> {
  if (!companyIds.length) {
    return []
  }

  return db
    .select({
      id: companiesTable.id,
      name: clientNameSql,
      slug: companiesTable.slug,
      notes: companiesTable.notes,
      state: companiesTable.state,
      originationContactId: currentOriginationContactIdSql(),
      originationUserId: currentOriginationUserIdSql(),
      billingType: currentBillingTypeSql(),
      companyId: companiesTable.id,
      createdBy: companiesTable.createdBy,
      createdAt: clientSinceSql,
      updatedAt: companiesTable.updatedAt,
      deletedAt: clientEndedAtSql,
    })
    .from(companiesTable)
    .where(
      and(inArray(companiesTable.id, companyIds), isClientCompany())
    )
}

export async function loadMemberRows(
  companyIds: string[]
): Promise<MemberRow[]> {
  if (!companyIds.length) {
    return []
  }

  const rows = await db
    .select({
      membership: {
        id: clientPortalAccess.contactId,
        companyId: clientPortalAccess.companyId,
        userId: clientPortalAccess.userId,
      },
      user: {
        id: usersTable.id,
        email: usersTable.email,
        fullName: personNameSql,
        role: usersTable.role,
        avatarUrl: personAvatarSql,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        deletedAt: usersTable.deletedAt,
        disabledAt: usersTable.disabledAt,
      },
    })
    .from(clientPortalAccess)
    .leftJoin(usersTable, eq(clientPortalAccess.userId, usersTable.id))
    .where(
      and(
        inArray(clientPortalAccess.companyId, companyIds),
        isNotNull(clientPortalAccess.userId)
      )
    )
  // Only people with a portal login are members of a client's projects.
  return rows.flatMap(row =>
    row.membership.userId
      ? [
          {
            ...row,
            membership: { ...row.membership, userId: row.membership.userId },
          },
        ]
      : []
  )
}

export function mapClientRows(rows: ClientRelationRow[]): DbClient[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    state: row.state,
    origination_contact_id: row.originationContactId,
    origination_user_id: row.originationUserId,
    billing_type: row.billingType,
    company_id: row.companyId,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt ?? row.updatedAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }))
}

export function mapMemberRows(rows: MemberRow[]): MemberWithUser[] {
  return rows.map(row => ({
    id: row.membership.id,
    company_id: row.membership.companyId,
    user_id: row.membership.userId,
    // Access has no date of its own; the login's creation stands in.
    created_at: row.user?.createdAt ?? '',
    deleted_at: null,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          full_name: row.user.fullName,
          role: row.user.role,
          avatar_url: row.user.avatarUrl,
          created_at: row.user.createdAt,
          updated_at: row.user.updatedAt,
          deleted_at: row.user.deletedAt,
          disabled_at: row.user.disabledAt,
        }
      : null,
  }))
}
