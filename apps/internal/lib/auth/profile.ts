import 'server-only'

import type { User } from '@supabase/supabase-js'

import { eq } from 'drizzle-orm'

import type { UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'
import { isUserAvatarPath } from '@/lib/storage/avatar'

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
  const metadataFullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() || null
  const metadataAvatar = user.user_metadata?.avatar_url as string | undefined

  // Accounts are provisioned by an admin — createPortalUser and
  // findOrCreatePortalUser both insert the `users` row explicitly. Authenticating
  // is not enough to earn one: without this guard any Google account that
  // completes an OAuth flow would self-provision a row here.
  if (!existing) {
    return 'not_provisioned'
  }

  // Name and avatar are seeded, never re-synced. Supabase merges the identity
  // provider's own values into `user_metadata` at every sign-in, so mirroring
  // them back would let Google overwrite the portal profile — and a Google
  // account with no picture (no `avatar_url` at all) would wipe the stored
  // avatar outright. The avatar column holds a bucket object path, not a URL,
  // so a provider CDN URL is rejected here rather than 404ing later in
  // /api/storage/user-avatar/[userId].
  const seedFullName = !existing.fullName && metadataFullName ? metadataFullName : null
  const seedAvatar =
    !existing.avatarUrl && isUserAvatarPath(metadataAvatar, user.id)
      ? metadataAvatar
      : null

  const shouldUpdate =
    existing.email !== nextEmail ||
    existing.role !== resolvedRole ||
    seedFullName !== null ||
    seedAvatar !== null

  if (!shouldUpdate) {
    return 'ok'
  }

  await db
    .update(usersTable)
    .set({
      email: nextEmail,
      role: resolvedRole,
      deletedAt: null,
      ...(seedFullName ? { fullName: seedFullName } : {}),
      ...(seedAvatar ? { avatarUrl: seedAvatar } : {}),
    })
    .where(eq(usersTable.id, user.id))

  return 'ok'
}
