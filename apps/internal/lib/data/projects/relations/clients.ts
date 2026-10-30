import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/clients/commission-terms'
import { db } from '@/lib/db'
import {
  clientPortalAccess,
  clients as clientsTable,
  users as usersTable,
} from '@/lib/db/schema'
import type { DbClient, DbUser } from '@/lib/types'

import type { MemberWithUser } from '../types'

export type ClientRow = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  state: string | null
  originationContactId: string | null
  originationUserId: string | null
  billingType: DbClient['billing_type']
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type MemberRow = {
  /** A portal login with access to the client (`client_portal_access`). */
  membership: {
    /** The contact behind the login. */
    id: string
    clientId: string
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
  clientIds: string[]
): Promise<ClientRow[]> {
  if (!clientIds.length) {
    return []
  }

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      slug: clientsTable.slug,
      notes: clientsTable.notes,
      state: clientsTable.state,
      originationContactId: currentOriginationContactIdSql(),
      originationUserId: currentOriginationUserIdSql(),
      billingType: clientsTable.billingType,
      createdBy: clientsTable.createdBy,
      createdAt: clientsTable.createdAt,
      updatedAt: clientsTable.updatedAt,
      deletedAt: clientsTable.deletedAt,
    })
    .from(clientsTable)
    .where(
      and(inArray(clientsTable.id, clientIds), isNull(clientsTable.deletedAt))
    )
}

export async function loadMemberRows(
  clientIds: string[]
): Promise<MemberRow[]> {
  if (!clientIds.length) {
    return []
  }

  const rows = await db
    .select({
      membership: {
        id: clientPortalAccess.contactId,
        clientId: clientPortalAccess.clientId,
        userId: clientPortalAccess.userId,
      },
      user: {
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        avatarUrl: usersTable.avatarUrl,
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
        inArray(clientPortalAccess.clientId, clientIds),
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

export function mapClientRows(rows: ClientRow[]): DbClient[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    state: row.state,
    origination_contact_id: row.originationContactId,
    origination_user_id: row.originationUserId,
    billing_type: row.billingType,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }))
}

export function mapMemberRows(rows: MemberRow[]): MemberWithUser[] {
  return rows.map(row => ({
    id: row.membership.id,
    client_id: row.membership.clientId,
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
