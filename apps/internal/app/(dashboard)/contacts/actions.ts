'use server'

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
  promoteContactToUserMutation,
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
  '/contacts',
  '/contacts/archive',
  '/contacts/activity',
  // Companies list their people (and contact saves can join or leave one).
  '/companies',
]

export async function saveContact(
  input: ContactInput
): Promise<ContactActionResult> {
  return runContactMutation(input, saveContactMutation)
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
  if (!UUID_PATTERN.test(contactId)) return { memberships: [] }
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

export async function promoteContactToUser(
  contactId: string
): Promise<ContactActionResult> {
  const user = await requireUser()
  const mutationResult = await promoteContactToUserMutation(
    { user },
    { contactId }
  )
  const { didMutate, ...result } = mutationResult

  if (didMutate) {
    for (const path of CONTACT_ROUTES_TO_REVALIDATE) {
      revalidatePath(path)
    }
    revalidatePath('/settings/users')
  }

  return result
}

/** Options for the contact picker (lead sheet). */
export async function fetchContactOptions(): Promise<ContactOption[]> {
  const user = await requireCrmUser()
  return listContactOptions(user)
}
