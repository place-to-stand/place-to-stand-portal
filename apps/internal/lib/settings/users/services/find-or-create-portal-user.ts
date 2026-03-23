import { and, eq, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import {
  dispatchPortalInvite,
  generateTemporaryPassword,
} from '../user-service'
import { createPortalUser } from './create-user'
import type { UserServiceResult } from '../types'

/**
 * Finds an existing portal user by email or creates a new one.
 *
 * Handles the case where a Supabase auth user exists but there is no
 * corresponding row in the `users` table (e.g. created through the client
 * portal sign-up flow, or left behind by a previously failed operation).
 */
export async function findOrCreatePortalUser(
  actor: AppUser,
  input: { email: string; fullName: string | null }
): Promise<UserServiceResult> {
  assertAdmin(actor)

  // 1. Check our users table for an active user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
    .limit(1)

  if (existingUser) {
    return { userId: existingUser.id }
  }

  // 2. Try creating through the normal flow (handles auth + DB + invite)
  const createResult = await createPortalUser(actor, {
    email: input.email,
    fullName: input.fullName ?? input.email,
    role: 'CLIENT',
  })

  if (!createResult.error) {
    return createResult
  }

  // 3. If "already registered", the auth user exists but our DB doesn't have them
  if (!createResult.error.includes('already been registered')) {
    return createResult
  }

  // 4. Look up the existing auth user via raw SQL on auth.users
  const [authRow] = await db.execute<{ id: string }>(
    sql`SELECT id FROM auth.users WHERE email = ${input.email} LIMIT 1`
  )

  const authUserId = authRow?.id
  if (!authUserId) {
    return { error: 'Unable to find existing auth account.' }
  }

  // 5. Check if there's a soft-deleted users row we can restore
  const [deletedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1)

  if (deletedUser) {
    // Restore the soft-deleted row
    await db
      .update(users)
      .set({ deletedAt: null, updatedAt: new Date().toISOString() })
      .where(eq(users.id, authUserId))
  } else {
    // Create the missing users table row
    await db.insert(users).values({
      id: authUserId,
      email: input.email,
      fullName: input.fullName ?? input.email,
      role: 'CLIENT',
    })
  }

  // 6. Reset their password and send an invite so they can sign in
  const adminClient = getSupabaseServiceClient()
  const temporaryPassword = generateTemporaryPassword()

  const updateResult = await adminClient.auth.admin.updateUserById(authUserId, {
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName ?? input.email,
      role: 'CLIENT',
      must_reset_password: true,
    },
  })

  if (updateResult.error) {
    console.error('Failed to reset password for existing auth user', updateResult.error)
    return { error: 'Unable to reset credentials for existing account.' }
  }

  try {
    await dispatchPortalInvite({
      email: input.email,
      fullName: input.fullName ?? input.email,
      temporaryPassword,
    })
  } catch (error) {
    console.error('Failed to send invite to existing auth user', error)
    // Non-fatal: user account is linked, they just won't get the email
  }

  return { userId: authUserId }
}
