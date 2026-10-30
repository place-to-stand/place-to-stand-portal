'use server'

import { sendPersonPasswordReset } from '@/lib/settings/contacts/person-sign-in'
import {
  savePersonSheet,
  type PersonSheetInput,
  type PersonSheetResult,
} from '@/lib/settings/contacts/person-sheet/save-person-sheet'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { listClosedMonthStarts } from '@/lib/queries/reports/close-snapshots'
import {
  roleMonthOptions,
  type RoleMonthOption,
} from '@/lib/settings/users/role-months'

import { revalidatePath } from 'next/cache'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import {
  type ContactActionResult,
  type DeleteContactInput,
  type DestroyContactInput,
  type RestoreContactInput,
} from '@/lib/settings/contacts/contact-service'
import {
  destroyContactMutation,
  restoreContactMutation,
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

export type PersonSignInDetails = {
  account: PortalAccountSummary | null
  roleMonths: RoleMonthOption[]
}

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
  if (!UUID_PATTERN.test(contactId)) return { memberships: [], avatarUrl: null, person: null }
  return getSheetData(user, contactId)
}

/**
 * A person's sign-in for the sheet (admins): the account, and the months a
 * role change can start from.
 */
export async function getPersonSignIn(
  userId: string
): Promise<PersonSignInDetails> {
  const user = await requireUser()
  // Server actions take arbitrary input; guard before the uuid cast.
  if (!UUID_PATTERN.test(userId)) return { account: null, roleMonths: [] }
  const [account, closedMonths] = await Promise.all([
    getPortalAccountSummary(user, userId),
    listClosedMonthStarts(),
  ])
  return {
    account,
    roleMonths: roleMonthOptions(currentMonthStartUtc(), closedMonths),
  }
}

/** Options for the contact picker (lead sheet). */
export async function fetchContactOptions(): Promise<ContactOption[]> {
  const user = await requireCrmUser()
  return listContactOptions(user)
}

/** Emails the person a link to set a new password (admins). */
export async function sendPersonPasswordResetAction(
  contactId: string
): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(contactId)) return { error: 'Invalid person.' }
  return sendPersonPasswordReset(user, contactId)
}
