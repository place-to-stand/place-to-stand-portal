import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import type { User } from '@supabase/supabase-js'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, users as usersTable } from '@/lib/db/schema'
import { isUserAvatarPath } from '@/lib/storage/avatar'

/**
 * `not_provisioned` means the visitor authenticated successfully but has no `users` row.
 * Callers that hold a session must sign it out and send them to `/account-not-set-up`,
 * otherwise the session survives and every subsequent request re-runs the redirect.
 */
export type EnsureProfileResult = 'ok' | 'not_provisioned'

export async function ensureUserProfile(
  user: User
): Promise<EnsureProfileResult> {
  const existingRows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: personNameSql,
      avatarUrl: personAvatarSql,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)

  const existing = existingRows[0]

  const nextEmail = user.email ?? ''
  const metadataAvatar = user.user_metadata?.avatar_url as string | undefined

  // Accounts are provisioned by an admin — the person sheet's Save
  // (savePersonSheet) inserts the `users` row explicitly. Authenticating
  // is not enough to earn one: without this guard any Google account that
  // completes an OAuth flow would self-provision a row here.
  if (!existing) {
    return 'not_provisioned'
  }

  // Role is never read from the auth user. `user_metadata` is writable by the
  // signed-in user themselves (supabase.auth.updateUser), so trusting a role
  // there would let any account promote itself. The `users` row is the only
  // source of truth; admins change it on the person sheet.

  // Name and avatar are seeded, never re-synced. Supabase merges the identity
  // provider's own values into `user_metadata` at every sign-in, so mirroring
  // them back would let Google overwrite the portal profile — and a Google
  // account with no picture (no `avatar_url` at all) would wipe the stored
  // avatar outright. The avatar column holds a bucket object path, not a URL,
  // so a provider CDN URL is rejected here rather than 404ing later in
  // /api/storage/user-avatar/[userId].
  const seedAvatar =
    !existing.avatarUrl && isUserAvatarPath(metadataAvatar, user.id)
      ? metadataAvatar
      : null

  const shouldUpdate =
    existing.email !== nextEmail ||
    seedAvatar !== null

  if (!shouldUpdate) {
    return 'ok'
  }

  if (existing.email !== nextEmail) {
    await db
      .update(usersTable)
      .set({ email: nextEmail, deletedAt: null })
      .where(eq(usersTable.id, user.id))
  }
  // The photo is the person's (contacts.avatar_url, 0112).
  if (seedAvatar) {
    await db
      .update(contacts)
      .set({ avatarUrl: seedAvatar, updatedAt: new Date().toISOString() })
      .where(and(eq(contacts.userId, user.id), isNull(contacts.deletedAt)))
  }

  return 'ok'
}
