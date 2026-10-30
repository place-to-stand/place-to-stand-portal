import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAvatarObject,
  moveAvatarToPersonFolder,
} from '@/lib/storage/avatar'

const STAGED_UPLOAD =
  /^avatars\/pending\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.[a-z0-9]+$/i

/** A path the upload route staged for this actor (generateAvatarPath). */
function isStagedUploadOf(path: string, actorId: string) {
  const match = path.match(STAGED_UPLOAD)
  return Boolean(match && match[1] === actorId)
}

/**
 * Sets or removes a person's photo (contacts.avatar_url, the only copy
 * since 0112). Takes the actor so only their own staged upload is used.
 */
export async function updatePersonAvatar(
  actor: { id: string },
  input: {
    contactId: string
    avatarPath?: string | null
    avatarRemoved?: boolean
  }
): Promise<{ error?: string }> {
  const [person] = await db
    .select({ avatarUrl: contacts.avatarUrl, userId: contacts.userId })
    .from(contacts)
    .where(and(eq(contacts.id, input.contactId), isNull(contacts.deletedAt)))
    .limit(1)
  if (!person) return { error: 'Person not found.' }

  const current = person.avatarUrl ?? null
  const incoming = input.avatarPath?.trim() || null
  if (!input.avatarRemoved && (!incoming || incoming === current)) return {}
  // Only the caller's own staged upload can become someone's photo, never
  // another object in the bucket (someone else's photo or upload).
  if (!input.avatarRemoved && incoming && !isStagedUploadOf(incoming, actor.id)) {
    return { error: 'Upload the photo again.' }
  }

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
