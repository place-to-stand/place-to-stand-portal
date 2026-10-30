import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  AVATAR_BUCKET,
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
 * A photo change claimed for a Save: the staged upload moved into the
 * person's folder before the transaction, the path to write
 * (contacts.avatar_url) in it, and the old photo to delete after commit.
 */
export type AvatarClaim = {
  /** contacts.avatar_url after the save. */
  next: string | null
  previous: string | null
  /** Set when a staged upload was moved (undo moves it back). */
  moved: { from: string; to: string } | null
}

/**
 * Claims a person's new photo (or its removal) before the save's
 * transaction. Only the caller's own staged upload can become someone's
 * photo, never another object in the bucket. Null when nothing changes.
 */
export async function claimPersonAvatar(
  actor: { id: string },
  input: {
    contactId: string
    previous: string | null
    path: string | null
    removed: boolean
  }
): Promise<{ error: string } | { claim: AvatarClaim | null }> {
  const incoming = input.path?.trim() || null
  if (input.removed) {
    return input.previous
      ? { claim: { next: null, previous: input.previous, moved: null } }
      : { claim: null }
  }
  if (!incoming || incoming === input.previous) return { claim: null }
  if (!isStagedUploadOf(incoming, actor.id)) {
    return { error: 'Upload the photo again.' }
  }
  try {
    const next = await moveAvatarToPersonFolder({
      client: getSupabaseServiceClient(),
      path: incoming,
      contactId: input.contactId,
    })
    return {
      claim: {
        next,
        previous: input.previous,
        moved: next === incoming ? null : { from: incoming, to: next },
      },
    }
  } catch (error) {
    console.error('Failed to store person photo', error)
    return { error: 'Unable to save the photo.' }
  }
}

/** Undo for a failed Save: the upload goes back to staging for a retry. */
export async function releaseAvatarClaim(claim: AvatarClaim): Promise<void> {
  if (!claim.moved) return
  const { error } = await getSupabaseServiceClient()
    .storage.from(AVATAR_BUCKET)
    .move(claim.moved.to, claim.moved.from)
  if (error) console.error('Failed to return the staged photo', error)
}

/** After commit: the replaced photo is no longer anyone's. */
export async function finishAvatarClaim(claim: AvatarClaim): Promise<void> {
  if (!claim.previous || claim.previous === claim.next) return
  try {
    await deleteAvatarObject({
      client: getSupabaseServiceClient(),
      path: claim.previous,
    })
  } catch (error) {
    console.error('Failed to delete the previous photo', error)
  }
}
