import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

import { fetchLastSignIns } from './settings'

/** What a contact's sheet shows about the portal user it was promoted to. */
export type PortalAccountSummary = {
  id: string
  fullName: string | null
  email: string
  createdAt: string
  disabledAt: string | null
  deletedAt: string | null
  lastSignInAt: string | null
}

/**
 * The portal account behind a contact (`contacts.user_id`). Archived users
 * are returned, not hidden — the contact still points at them, and the sheet
 * should say so rather than claim there is no account.
 */
export async function getPortalAccountSummary(
  actor: AppUser,
  userId: string
): Promise<PortalAccountSummary | null> {
  assertAdmin(actor)

  const [[row], lastSignIns] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        createdAt: users.createdAt,
        disabledAt: users.disabledAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    fetchLastSignIns([userId]),
  ])

  if (!row) {
    return null
  }

  return { ...row, lastSignInAt: lastSignIns.get(userId) ?? null }
}
