import { ensurePersonForUser } from './person'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { serverEnv } from '@/lib/env.server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import {
  dispatchAdminInvite,
  dispatchPortalInvite,
  generateTemporaryPassword,
} from '../user-service'
import type { CreateUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function createPortalUser(
  actor: AppUser,
  input: CreateUserInput,
  /**
   * A sign-in belongs to a person. The Users page creates or finds that
   * person here, in the same transaction; promoting a contact links its own
   * contact instead (`linkPerson: false`).
   */
  options: { linkPerson?: boolean } = {}
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()
  const temporaryPassword = generateTemporaryPassword()

  const createResult = await adminClient.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      must_reset_password: true,
    },
  })

  if (createResult.error || !createResult.data.user) {
    console.error('Failed to create auth user', createResult.error)
    return {
      error: createResult.error?.message ?? 'Unable to create Supabase user.',
    }
  }

  const userId = createResult.data.user.id

  try {
    await db.transaction(async tx => {
      await tx.insert(users).values({
        id: userId,
        email: input.email,
        role: input.role,
      })
      if (options.linkPerson !== false) {
        await ensurePersonForUser(tx, {
          userId,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
        })
      }
    })
  } catch (error) {
    console.error('Failed to insert user profile', error)
    await adminClient.auth.admin.deleteUser(userId)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to create Supabase user.',
    }
  }

  try {
    if (input.role === 'ADMIN' || input.role === 'SALES') {
      // Staff accounts (ADMIN, and SALES for the CRM) sign in to this app, so
      // they keep the temp-password flow: the proxy forces a reset on first
      // sign-in, and the sign-in-method choice is portal-only.
      const headersList = await headers()
      const baseUrl =
        headersList.get('origin') ??
        serverEnv.APP_BASE_URL ??
        'http://localhost:3000'

      await dispatchAdminInvite({
        email: input.email,
        fullName: input.fullName,
        temporaryPassword,
        baseUrl,
      })
    } else {
      // Clients get a sign-in link instead. `temporaryPassword` above is still
      // set on the account but never disclosed — it keeps /forgot-password
      // working for clients who pick a passwordless method during onboarding.
      await dispatchPortalInvite({
        email: input.email,
        fullName: input.fullName,
      })
    }
  } catch (error) {
    console.error('Failed to dispatch portal invite', error)
    try {
      await db.delete(users).where(eq(users.id, userId))
    } catch (dbError) {
      console.error(
        'Failed to rollback user profile after invite error',
        dbError
      )
    }
    await adminClient.auth.admin.deleteUser(userId)
    return { error: 'Unable to send invite email. Please try again.' }
  }

  return { userId }
}
