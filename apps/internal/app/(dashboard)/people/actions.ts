'use server'

import { updatePersonAvatar } from '@/lib/settings/contacts/person-avatar'
import {
  savePersonSignIn,
  sendPersonPasswordReset,
  syncSignInEmail,
} from '@/lib/settings/contacts/person-sign-in'
import { isAdminRole } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

import { revalidatePath } from 'next/cache'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import {
  type ContactActionResult,
  type ContactInput,
  type DeleteContactInput,
  type DestroyContactInput,
  type RestoreContactInput,
} from '@/lib/settings/contacts/contact-service'
import {
  destroyContactMutation,
  restoreContactMutation,
  saveContactMutation,
  softDeleteContactMutation,
} from '@/lib/settings/contacts/actions'
import type {
  ContactMutationContext,
  ContactMutationResult,
} from '@/lib/settings/contacts/actions'
import {
  getContactSheetData as getSheetData,
  type ContactSheetData,
} from '@/lib/queries/contacts'
import {
  listContactOptions,
  type ContactOption,
} from '@/lib/queries/contacts/options'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import {
  getPortalAccountSummary,
  type PortalAccountSummary,
} from '@/lib/queries/users/portal-account'

const CONTACT_ROUTES_TO_REVALIDATE = [
  '/people',
  '/people/archive',
  '/people/activity',
  // Companies list their people (and contact saves can join or leave one).
  '/companies',
]

export async function saveContact(
  input: ContactInput
): Promise<ContactActionResult> {
  // Their email is their sign-in: only an admin changes it for someone who
  // can sign in, and the login follows.
  const user = await requireCrmUser()
  const [existing] = input.id
    ? await db
        .select({ email: contacts.email, userId: contacts.userId })
        .from(contacts)
        .where(eq(contacts.id, input.id))
        .limit(1)
    : []
  const emailChanged =
    Boolean(existing?.userId) &&
    (existing?.email ?? '').toLowerCase() !==
      (input.email ?? '').toLowerCase()
  if (emailChanged && !isAdminRole(user.role)) {
    return {
      error: 'Only an admin can change the email of someone who can sign in.',
    }
  }
  if (emailChanged && !input.email) {
    return { error: 'Someone who can sign in needs an email.' }
  }

  const result = await runContactMutation(input, saveContactMutation)
  if (!result.error && emailChanged && input.id) {
    const synced = await syncSignInEmail(user, input.id)
    if (synced.error) return { ...result, error: synced.error }
  }
  return result
}

export async function softDeleteContact(
  input: DeleteContactInput
): Promise<ContactActionResult> {
  return runContactMutation(input, softDeleteContactMutation)
}

export async function restoreContact(
  input: RestoreContactInput
): Promise<ContactActionResult> {
  return runContactMutation(input, restoreContactMutation)
}

export async function destroyContact(
  input: DestroyContactInput
): Promise<ContactActionResult> {
  return runContactMutation(input, destroyContactMutation)
}

async function runContactMutation<TInput>(
  input: TInput,
  mutate: (
    context: ContactMutationContext,
    payload: TInput
  ) => Promise<ContactMutationResult>
): Promise<ContactActionResult> {
  // CRM staff may save, archive and restore; destroy re-checks admin inside
  // its mutation.
  const user = await requireCrmUser()
  const mutationResult = await mutate({ user }, input)
  const { didMutate, ...result } = mutationResult

  if (didMutate) {
    for (const path of CONTACT_ROUTES_TO_REVALIDATE) {
      revalidatePath(path)
    }
  }

  return result
}

/** The contact sheet's Companies list. */
export async function getContactSheetData(
  contactId: string
): Promise<ContactSheetData> {
  const user = await requireCrmUser()
  // Server actions take arbitrary input; guard before the uuid cast.
  if (!UUID_PATTERN.test(contactId)) return { memberships: [], avatarUrl: null }
  return getSheetData(user, contactId)
}

/** The portal user a contact was promoted to, for the sheet's Portal access card. */
export async function getContactPortalAccount(
  userId: string
): Promise<PortalAccountSummary | null> {
  const user = await requireUser()
  // Server actions take arbitrary input; guard before the uuid cast.
  if (!UUID_PATTERN.test(userId)) return null
  return getPortalAccountSummary(user, userId)
}


/** Options for the contact picker (lead sheet). */
export async function fetchContactOptions(): Promise<ContactOption[]> {
  const user = await requireCrmUser()
  return listContactOptions(user)
}

/** Saves a person's photo after the sheet's Save (staged upload or removal). */
export async function savePersonAvatar(input: {
  contactId: string
  avatarPath?: string | null
  avatarRemoved?: boolean
}): Promise<{ error?: string }> {
  await requireCrmUser()
  if (!UUID_PATTERN.test(input.contactId)) return { error: 'Invalid person.' }
  return updatePersonAvatar(input)
}

/** The Sign-in tab's save: "Can sign in" and the role (admins). */
export async function savePersonSignInAction(input: {
  contactId: string
  enabled: boolean
  role: 'ADMIN' | 'SALES' | 'CLIENT'
}): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(input.contactId)) return { error: 'Invalid person.' }
  const result = await savePersonSignIn(user, input)
  for (const path of CONTACT_ROUTES_TO_REVALIDATE) revalidatePath(path)
  return result
}

/** Emails the person a link to set a new password (admins). */
export async function sendPersonPasswordResetAction(
  contactId: string
): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(contactId)) return { error: 'Invalid person.' }
  return sendPersonPasswordReset(user, contactId)
}
