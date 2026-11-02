'use server'

import { sendPersonPasswordReset } from '@/lib/people/person-sign-in'
import {
  savePersonSheet,
  type PersonSheetInput,
  type PersonSheetResult,
} from '@/lib/people/person-sheet/save-person-sheet'

import { revalidatePath } from 'next/cache'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import {
  type ContactActionResult,
  type DeleteContactInput,
  type RestoreContactInput,
} from '@/lib/people/contact-service'
import {
  restoreContactMutation,
  softDeleteContactMutation,
} from '@/lib/people/actions'
import type {
  ContactMutationContext,
  ContactMutationResult,
} from '@/lib/people/actions'
import { UUID_PATTERN } from '@/lib/sheets/entities'

const CONTACT_ROUTES_TO_REVALIDATE = [
  '/people',
  '/people/archive',
  '/people/activity',
  // Companies list their people (and contact saves can join or leave one).
  '/companies',
  // A person's name and sign-in show on sign-ins, project owners and members,
  // and lead contacts.
  '/settings/users',
  '/projects',
  '/leads',
]

/**
 * The person sheet's Save: the person, their companies, photo and sign-in
 * in one request and one transaction (see savePersonSheet).
 */
export async function savePersonSheetAction(
  input: PersonSheetInput
): Promise<PersonSheetResult> {
  const user = await requireCrmUser()
  if (input.id && !UUID_PATTERN.test(input.id)) {
    return { error: 'Invalid person.' }
  }
  const result = await savePersonSheet(user, input)
  if (!result.error) {
    for (const path of CONTACT_ROUTES_TO_REVALIDATE) revalidatePath(path)
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

async function runContactMutation<TInput>(
  input: TInput,
  mutate: (
    context: ContactMutationContext,
    payload: TInput
  ) => Promise<ContactMutationResult>
): Promise<ContactActionResult> {
  // CRM staff may archive and restore.
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

/** Emails the person a link to set a new password (admins). */
export async function sendPersonPasswordResetAction(
  contactId: string
): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(contactId)) return { error: 'Invalid person.' }
  return sendPersonPasswordReset(user, contactId)
}
