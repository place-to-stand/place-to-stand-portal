import { personNameSql } from '@pts/db/names'
import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientPortalAccess, users } from '@/lib/db/schema'

import type { ClientsSettingsMembersMap } from './types'

/**
 * Portal logins with access to each client: people with a current,
 * portal-enabled membership at the client's company (`client_portal_access`)
 * whose live CLIENT login exists.
 */
export async function buildMembersByClient(
  companyIds: string[]
): Promise<ClientsSettingsMembersMap> {
  if (!companyIds.length) {
    return {}
  }

  const rows = await db
    .select({
      companyId: clientPortalAccess.companyId,
      userId: users.id,
      email: users.email,
      fullName: personNameSql,
    })
    .from(clientPortalAccess)
    .innerJoin(users, eq(users.id, clientPortalAccess.userId))
    .where(
      and(
        inArray(clientPortalAccess.companyId, companyIds),
        eq(users.role, 'CLIENT'),
        isNull(users.deletedAt)
      )
    )

  return rows.reduce<ClientsSettingsMembersMap>((acc, row) => {
    const list = acc[row.companyId] ?? []
    list.push({
      id: row.userId,
      email: row.email,
      fullName: row.fullName,
    })
    acc[row.companyId] = list
    return acc
  }, {})
}
