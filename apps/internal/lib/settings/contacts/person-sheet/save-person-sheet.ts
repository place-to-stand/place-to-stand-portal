import 'server-only'

import { eq } from 'drizzle-orm'

import { isAdminRole } from '@/lib/auth/roles'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import type { ContactInput } from '@/lib/settings/contacts/contact-service'
import {
  isEmailConflict,
  loadExistingContact,
  logContactSave,
  prepareContactSave,
  writeContactSave,
} from '@/lib/settings/contacts/actions/save-contact'
import {
  claimPersonAvatar,
  finishAvatarClaim,
  releaseAvatarClaim,
  type AvatarClaim,
} from '@/lib/settings/contacts/person-avatar'
import {
  PERSON_SAVED_ELSEWHERE,
  PERSON_WITH_SIGN_IN_ADMIN_ONLY,
} from '@/lib/settings/contacts/person-sheet-copy'

import { finishSignIn, runSignInAuth, writeSignIn } from './sign-in-apply'
import { prepareSignIn, type SignInInput } from './sign-in-plan'
import { Undo } from './undo'

export type PersonSheetInput = ContactInput & {
  /** Their photo, when it changed: a staged upload, or removed. */
  avatar?: { path: string | null; removed: boolean }
  /** Their sign-in (admins), when it changed. */
  signIn?: SignInInput
  /**
   * Edit: the person's `updated_at` when the sheet loaded them. The save is
   * refused if it has changed since (someone else saved them).
   */
  loadedUpdatedAt?: string
}

/** Someone else saved the person after the sheet loaded them. */
class SavedElsewhereError extends Error {}

export type PersonSheetResult = {
  error?: string
  /** The new person's id (create). */
  id?: string
  /** Saved, but a follow-up (an invite email) didn't happen. */
  warning?: string
}

/**
 * The person sheet's Save: one request, one transaction. Validates
 * everything first; then the steps that can't join a transaction (Supabase
 * Auth, moving the staged photo) run and register their undo; then the
 * person, their companies, photo and sign-in commit together. If the
 * transaction fails the outside steps are undone. Activity rows, invite
 * emails and cleanup run after commit.
 */
export async function savePersonSheet(
  user: AppUser,
  input: PersonSheetInput
): Promise<PersonSheetResult> {
  const isUpdate = Boolean(input.id)
  return trackSettingsServerInteraction(
    { entity: 'contact', mode: isUpdate ? 'edit' : 'create', targetId: input.id ?? undefined },
    () => save(user, input)
  )
}

async function save(
  user: AppUser,
  input: PersonSheetInput
): Promise<PersonSheetResult> {
  const { avatar, signIn, loadedUpdatedAt, ...contactInput } = input
  const isAdmin = isAdminRole(user.role)

  const existing = input.id ? await loadExistingContact(input.id) : null
  if (input.id && (!existing || existing.deletedAt)) {
    return { error: 'Person not found.' }
  }
  if (existing?.userId && !isAdmin) {
    return { error: PERSON_WITH_SIGN_IN_ADMIN_ONLY }
  }
  // Checked early so a stale sheet changes nothing outside the database
  // either; checked again, under a row lock, inside the transaction.
  const isStale = (updatedAt: string) =>
    typeof loadedUpdatedAt === 'string' && updatedAt !== loadedUpdatedAt
  if (existing && isStale(existing.updatedAt)) {
    return { error: PERSON_SAVED_ELSEWHERE }
  }
  if (signIn && !isAdmin) {
    return { error: 'Only an admin can change someone’s sign-in.' }
  }

  const prepared = await prepareContactSave(user, contactInput, existing)
  if ('error' in prepared) return { error: prepared.error }
  const { plan } = prepared
  const contactId = plan.contactId

  const signInPrepared = isAdmin
    ? await prepareSignIn(user, {
        existing,
        nextEmail: plan.values.email,
        signIn,
      })
    : { plan: null }
  if ('error' in signInPrepared) return { error: signInPrepared.error }
  const signInPlan = signInPrepared.plan

  // Outside the transaction, each with its undo.
  const undo = new Undo()
  let avatarClaim: AvatarClaim | null = null
  if (avatar) {
    const claimed = await claimPersonAvatar(user, {
      contactId,
      previous: existing?.avatarUrl ?? null,
      path: avatar.path,
      removed: avatar.removed,
    })
    if ('error' in claimed) return { error: claimed.error }
    avatarClaim = claimed.claim
    if (avatarClaim) {
      const claim = avatarClaim
      undo.push(() => releaseAvatarClaim(claim))
    }
  }
  if (signInPlan) {
    const authError = await runSignInAuth(signInPlan, plan.values.name, undo)
    if (authError) {
      await undo.run()
      return { error: authError }
    }
  }

  try {
    await db.transaction(async tx => {
      if (plan.mode === 'update') {
        // One save per person at a time; and none over a newer one.
        const [locked] = await tx
          .select({ updatedAt: contacts.updatedAt })
          .from(contacts)
          .where(eq(contacts.id, contactId))
          .for('update')
        if (!locked || isStale(locked.updatedAt)) {
          throw new SavedElsewhereError()
        }
      }
      await writeContactSave(tx, user, plan)
      if (avatarClaim) {
        await tx
          .update(contacts)
          .set({ avatarUrl: avatarClaim.next, updatedAt: new Date().toISOString() })
          .where(eq(contacts.id, contactId))
      }
      if (signInPlan) await writeSignIn(tx, user, signInPlan, contactId)
    })
  } catch (error) {
    if (!(error instanceof SavedElsewhereError)) {
      console.error('Failed to save person', error)
    }
    await undo.run()
    if (error instanceof SavedElsewhereError) {
      return { error: PERSON_SAVED_ELSEWHERE }
    }
    if (isEmailConflict(error)) {
      return { error: 'A person with this email already exists.' }
    }
    return {
      error: input.id ? 'Unable to update person.' : 'Unable to create person.',
    }
  }

  // Committed: activity, follow-ups, cleanup.
  if (avatarClaim) {
    if (plan.mode === 'update' && !plan.changedFields.includes('photo')) {
      plan.changedFields.push('photo')
    }
    await finishAvatarClaim(avatarClaim)
  }
  await logContactSave(user, plan)
  const warning = signInPlan
    ? await finishSignIn(user, signInPlan, { contactId, name: plan.values.name })
    : null

  return {
    ...(plan.mode === 'create' ? { id: contactId } : {}),
    ...(warning ? { warning } : {}),
  }
}
