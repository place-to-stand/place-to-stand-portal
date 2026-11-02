import { sql } from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/lib/db'
import { serverEnv } from '@/lib/env.server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import {
  dispatchAdminInvite,
  dispatchPortalInvite,
  generateTemporaryPassword,
} from '../user-service'
import type { CreateUserInput } from '../user-validation'

type Role = CreateUserInput['role']

export type CreatedAuthUser =
  | { userId: string; temporaryPassword: string }
  | { error: string; alreadyRegistered: boolean }

/**
 * Creates the Supabase auth user for a new sign-in (a temporary password
 * they reset on first sign-in). Runs before the database transaction;
 * delete it again (`deleteAuthUser`) if that transaction fails.
 */
export async function createAuthUser(input: {
  email: string
  fullName: string
  role: Role
}): Promise<CreatedAuthUser> {
  const temporaryPassword = generateTemporaryPassword()
  const result = await getSupabaseServiceClient().auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      must_reset_password: true,
    },
  })
  if (result.error || !result.data.user) {
    console.error('Failed to create auth user', result.error)
    const message = result.error?.message ?? 'Unable to create the sign-in.'
    return {
      error: message,
      alreadyRegistered: message.includes('already been registered'),
    }
  }
  return { userId: result.data.user.id, temporaryPassword }
}

/**
 * Takes over an auth user found by email (one with no live sign-in row,
 * e.g. from a self sign-up) before the portal links it to a person.
 * Whoever made it may know its password or hold a session, so: a fresh
 * random password nobody is told, a forced reset on next sign-in, and
 * every existing session revoked. Runs before the save's transaction and
 * has no undo: an unlinked auth user losing its password and sessions is
 * harmless if the save fails. Returns an error message, or null.
 */
export async function takeOverExistingAuthUser(
  userId: string
): Promise<string | null> {
  const { error } = await getSupabaseServiceClient().auth.admin.updateUserById(
    userId,
    {
      password: generateTemporaryPassword(),
      user_metadata: { must_reset_password: true },
    }
  )
  if (error) {
    console.error('Failed to reset existing auth user', userId, error)
    return 'Unable to secure the existing sign-in. Please try again.'
  }

  // Supabase's admin API can only sign out a session by its JWT, so revoke
  // every session for the user directly (refresh tokens cascade).
  try {
    await db.execute(sql`DELETE FROM auth.sessions WHERE user_id = ${userId}`)
    await db.execute(
      sql`DELETE FROM auth.refresh_tokens WHERE user_id = ${userId}`
    )
  } catch (revokeError) {
    console.error('Failed to revoke existing auth sessions', userId, revokeError)
    return 'Unable to sign out the existing sign-in. Please try again.'
  }
  return null
}

export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await getSupabaseServiceClient().auth.admin.deleteUser(
    userId
  )
  if (error) console.error('Failed to delete auth user', userId, error)
}

/**
 * Emails a new sign-in its way in: staff get the temporary password for
 * this portal, clients a sign-in link to the client portal. Throws on
 * failure.
 */
export async function sendSignInInvite(input: {
  email: string
  fullName: string
  role: Role
  temporaryPassword: string
}): Promise<void> {
  if (input.role === 'ADMIN' || input.role === 'SALES') {
    // Staff sign in to this app with the temp-password flow: the proxy
    // forces a reset on first sign-in.
    const headersList = await headers()
    const baseUrl =
      headersList.get('origin') ??
      serverEnv.APP_BASE_URL ??
      'http://localhost:3000'
    await dispatchAdminInvite({
      email: input.email,
      fullName: input.fullName,
      temporaryPassword: input.temporaryPassword,
      baseUrl,
    })
    return
  }
  // Clients get a sign-in link instead. The temporary password stays set
  // but undisclosed, so /forgot-password keeps working for them.
  await dispatchPortalInvite({ email: input.email, fullName: input.fullName })
}
