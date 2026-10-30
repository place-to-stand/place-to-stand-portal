import { renamePersonForUser } from './person'
import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import type { UpdateUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function updatePortalUser(
  actor: AppUser,
  input: UpdateUserInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()

  try {
    await db.transaction(async tx => {
      await tx
        .update(users)
        .set({
          role: input.role,
          deletedAt: null,
        })
        .where(eq(users.id, input.id))
      // The name is the person's (their contact's).
      await renamePersonForUser(tx, input.id, input.fullName)
    })
  } catch (error) {
    console.error('Failed to update user profile', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to update user profile.',
    }
  }

  const authLookup = await adminClient.auth.admin.getUserById(input.id)

  if (authLookup.error || !authLookup.data?.user) {
    console.error('Failed to load auth user for update', authLookup.error)
    return {
      error: authLookup.error?.message ?? 'Unable to load Supabase user.',
    }
  }

  const currentMetadata = (authLookup.data.user.user_metadata ?? {}) as Record<
    string,
    unknown
  >

  const nextMetadata: Record<string, unknown> = {
    ...currentMetadata,
    full_name: input.fullName,
    role: input.role,
    deleted_at: null,
  }

  if (input.password) {
    nextMetadata.must_reset_password = true
  }

  const updatePayload: Parameters<
    typeof adminClient.auth.admin.updateUserById
  >[1] = {
    user_metadata: nextMetadata,
  }

  if (input.password) {
    updatePayload.password = input.password
  }

  const authUpdate = await adminClient.auth.admin.updateUserById(
    input.id,
    updatePayload
  )

  if (authUpdate.error) {
    console.error('Failed to sync auth metadata', authUpdate.error)
    return { error: authUpdate.error.message }
  }

  return {}
}
