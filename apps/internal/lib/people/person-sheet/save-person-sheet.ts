import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import type { ContactInput } from '@/lib/people/contact-service'
import {
  isEmailConflict,
  loadExistingContact,
  logContactSave,
  prepareContactSave,
  writeContactSave,
} from '@/lib/people/actions/save-contact'
import {
  claimPersonAvatar,
  finishAvatarClaim,
  releaseAvatarClaim,
  type AvatarClaim,
} from '@/lib/people/person-avatar'
import {
  PERSON_SAVED_ELSEWHERE,
  PERSON_WITH_SIGN_IN_ADMIN_ONLY,
  SIGN_IN_ADMIN_ONLY,
} from '@/lib/people/person-sheet-copy'

import { PortalAccessRefusal } from '@/lib/queries/companies/billing/settings/client-contacts'
import { PortalAccessForbiddenError } from '@/lib/queries/memberships'

import {
  finishPersonPortalAccess,
  planPersonPortalAccess,
  writePersonPortalAccess,
} from './portal-access'
import {
  describeSaveConflict,
  lockForSave,
  readSavedVersion,
  SaveConflictError,
} from '@/lib/sheets/save-conflict/server'
import { versionMs, type SaveConflict } from '@/lib/sheets/save-conflict/types'
import { finishSignIn, runSignInAuth, writeSignIn } from './sign-in-apply'
import { prepareSignIn, type SignInInput } from './sign-in-plan'
import { Undo } from './undo'
import { roleCan } from '@/lib/auth/capabilities'

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

export type PersonSheetResult = {
  error?: string
  /** The new person's id (create). */
  id?: string
  /** Saved, but a follow-up (an invite email) didn't happen. */
  warning?: string
  /** The person's version after the save; the sheet's next expected one. */
  updatedAt?: string
  /** Set when someone else saved first and nothing was written. */
  conflict?: SaveConflict
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
    {
      entity: 'contact',
      mode: isUpdate ? 'edit' : 'create',
      targetId: input.id ?? undefined,
    },
    () => save(user, input)
  )
}

async function save(
  user: AppUser,
  input: PersonSheetInput
): Promise<PersonSheetResult> {
  const { avatar, signIn, loadedUpdatedAt, ...contactInput } = input
  const isAdmin = roleCan(user.role, 'settings.users')

  const existing = input.id ? await loadExistingContact(input.id) : null
  if (input.id && (!existing || existing.deletedAt)) {
    return { error: 'Person not found.' }
  }
  if (existing?.userId && !isAdmin) {
    return { error: PERSON_WITH_SIGN_IN_ADMIN_ONLY }
  }
  // Checked early so a stale sheet changes nothing outside the database
  // either; checked again, under a row lock, inside the transaction.
  const conflictResult = async (error: SaveConflictError) => ({
    error: PERSON_SAVED_ELSEWHERE,
    conflict: await describeSaveConflict(
      user,
      'CONTACT',
      contactInput.id ?? '',
      error,
      loadedUpdatedAt
    ),
  })
  if (
    existing &&
    typeof loadedUpdatedAt === 'string' &&
    versionMs(existing.updatedAt) !== versionMs(loadedUpdatedAt)
  ) {
    return conflictResult(new SaveConflictError(existing.updatedAt))
  }
  if (signIn && !isAdmin) {
    return { error: SIGN_IN_ADMIN_ONLY }
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

  // Portal access to their client companies (admins), as on the company
  // sheet's People section.
  const portalPlanned = await planPersonPortalAccess(
    plan,
    contactInput.companies
  )
  if ('error' in portalPlanned) return { error: portalPlanned.error }
  const { portal } = portalPlanned

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
  let savedVersion: string | null = null
  try {
    await db.transaction(async tx => {
      if (plan.mode === 'update') {
        // One save per person at a time; and none over a newer one.
        if (!(await lockForSave(tx, contacts, contactId, loadedUpdatedAt))) {
          throw new Error('Person not found.')
        }
      }
      await writeContactSave(tx, user, plan)
      if (avatarClaim) {
        await tx
          .update(contacts)
          .set({
            avatarUrl: avatarClaim.next,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(contacts.id, contactId))
      }
      if (signInPlan) await writeSignIn(tx, user, signInPlan, contactId)
      await writePersonPortalAccess(tx, user, contactId, portal)
      savedVersion = await readSavedVersion(tx, contacts, contactId)
    })
  } catch (error) {
    if (!(error instanceof SaveConflictError)) {
      console.error('Failed to save person', error)
    }
    await undo.run()
    if (error instanceof SaveConflictError) {
      return conflictResult(error)
    }
    if (isEmailConflict(error)) {
      return { error: 'A person with this email already exists.' }
    }
    if (
      error instanceof PortalAccessRefusal ||
      error instanceof PortalAccessForbiddenError
    ) {
      return { error: error.message }
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
  // Portal changes are logged as CONTACT_CLIENT_LINKED / UNLINKED (kept
  // from Sales), not in the person's changed fields, which Sales can read.
  await logContactSave(user, plan)
  await finishPersonPortalAccess(user, contactId, portal)
  const warning = signInPlan
    ? await finishSignIn(user, signInPlan, {
        contactId,
        name: plan.values.name,
      })
    : null

  return {
    ...(plan.mode === 'create' ? { id: contactId } : {}),
    ...(warning ? { warning } : {}),
    ...(savedVersion ? { updatedAt: savedVersion } : {}),
  }
}
