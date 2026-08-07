import 'server-only'

import type { User } from '@supabase/supabase-js'

import { eq } from 'drizzle-orm'

import type { UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'

const DEFAULT_ROLE: UserRole = 'CLIENT'

const VALID_ROLES: readonly UserRole[] = ['ADMIN', 'CLIENT']

/**
 * `not_provisioned` means the visitor authenticated successfully but has no `users` row.
 * Callers that hold a session must sign it out and send them to `/account-not-set-up`,
 * otherwise the session survives and every subsequent request re-runs the redirect.
 */
export type EnsureProfileResult = 'ok' | 'not_provisioned'

function getMetadataRole(user: User): UserRole | null {
  const rawRole = user.user_metadata?.role

  if (typeof rawRole !== 'string') {
    return null
  }

  const role = rawRole.toUpperCase() as UserRole

  return VALID_ROLES.includes(role) ? role : null
}

export async function ensureUserProfile(
  user: User
): Promise<EnsureProfileResult> {
  const existingRows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      fullName: usersTable.fullName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)

  const existing = existingRows[0]

  const metadataRole = getMetadataRole(user)
  const resolvedRole = metadataRole ?? existing?.role ?? DEFAULT_ROLE

  const nextEmail = user.email ?? ''
  const nextFullName = (user.user_metadata?.full_name as string | undefined) ?? null
  const nextAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null

  // Accounts are provisioned by an admin — createPortalUser and
  // findOrCreatePortalUser both insert the `users` row explicitly. Authenticating
  // is not enough to earn one: without this guard any Google account that
  // completes an OAuth flow would self-provision a row here.
  if (!existing) {
    return 'not_provisioned'
  }

  const shouldUpdate =
    existing.email !== nextEmail ||
    existing.role !== resolvedRole ||
    existing.fullName !== nextFullName ||
    existing.avatarUrl !== nextAvatar

  if (!shouldUpdate) {
    return 'ok'
  }

  await db
    .update(usersTable)
    .set({
      email: nextEmail,
      fullName: nextFullName,
      role: resolvedRole,
      avatarUrl: nextAvatar,
      deletedAt: null,
    })
    .where(eq(usersTable.id, user.id))

  return 'ok'
}
