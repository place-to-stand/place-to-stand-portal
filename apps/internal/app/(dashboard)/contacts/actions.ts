'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
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
  syncContactClients as syncClients,
  type ContactSheetData,
} from '@/lib/queries/contacts'

const CONTACT_ROUTES_TO_REVALIDATE = [
  '/contacts',
  '/contacts/archive',
  '/contacts/activity',
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
  const user = await requireUser()
  const mutationResult = await mutate({ user }, input)
  const { didMutate, ...result } = mutationResult

  if (didMutate) {
    for (const path of CONTACT_ROUTES_TO_REVALIDATE) {
      revalidatePath(path)
    }
  }

  return result
}

/**
 * Fetches all data needed for the contact sheet client picker.
 */
export async function getContactSheetData(
  contactId?: string
): Promise<ContactSheetData> {
  const user = await requireUser()
  return getSheetData(user, contactId)
}

/**
 * Syncs the client links for a contact (adds new, removes unlinked).
 */
export async function syncContactClients(
  contactId: string,
  clientIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser()
  const result = await syncClients(user, contactId, clientIds)

  if (result.ok) {
    for (const path of CONTACT_ROUTES_TO_REVALIDATE) {
      revalidatePath(path)
    }
  }

  return result
}
