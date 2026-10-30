import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAvatarObject,
  moveAvatarToPersonFolder,
} from '@/lib/storage/avatar'

/**
 * Sets or removes a person's photo (contacts.avatar_url). Their sign-in, if
 * any, carries the same path until the sign-in table drops its own copy.
 */
export async function updatePersonAvatar(input: {
  contactId: string
  avatarPath?: string | null
  avatarRemoved?: boolean
}): Promise<{ error?: string }> {
  const [person] = await db
    .select({ avatarUrl: contacts.avatarUrl, userId: contacts.userId })
    .from(contacts)
    .where(eq(contacts.id, input.contactId))
    .limit(1)
  if (!person) return { error: 'Person not found.' }

  const current = person.avatarUrl ?? null
  const incoming = input.avatarPath?.trim() || null
  if (!input.avatarRemoved && (!incoming || incoming === current)) return {}

  const client = getSupabaseServiceClient()
  let next: string | null = null
  try {
    next = input.avatarRemoved
      ? null
      : await moveAvatarToPersonFolder({
          client,
          path: incoming!,
          contactId: input.contactId,
        })
  } catch (error) {
    console.error('Failed to store person photo', error)
    return { error: 'Unable to save the photo.' }
  }

  await db.transaction(async tx => {
    const now = new Date().toISOString()
    await tx
      .update(contacts)
      .set({ avatarUrl: next, updatedAt: now })
      .where(eq(contacts.id, input.contactId))
  })

  if (current && current !== next) {
    try {
      await deleteAvatarObject({ client, path: current })
    } catch (error) {
      console.error('Failed to delete the previous photo', error)
    }
  }
  return {}
}
