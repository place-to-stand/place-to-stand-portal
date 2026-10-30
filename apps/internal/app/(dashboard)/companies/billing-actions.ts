'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import {
  type ClientActionResult,
  type ClientInput,
  type DeleteClientInput,
  type RestoreClientInput,
} from '@/lib/companies/billing/client-service'
import {
  restoreClientMutation,
  saveClientMutation,
  softDeleteClientMutation,
} from '@/lib/companies/billing/actions'
import type {
  ClientMutationContext,
  ClientMutationResult,
} from '@/lib/companies/billing/actions'
import {
  getClientSheetContactData as getContactData,
  syncClientContacts as syncContacts,
  type ClientSheetContactData,
} from '@/lib/queries/clients/settings/client-contacts'

// A client is a company you bill: its screens are the company's.
const CLIENT_ROUTES_TO_REVALIDATE = [
  '/companies',
  '/companies/archive',
  '/companies/activity',
  '/projects',
]

/**
 * Revalidates client-related paths after mutations.
 * Uses layout-level revalidation to cover all client pages including dynamic detail pages.
 */
function revalidateClientPaths() {
  for (const path of CLIENT_ROUTES_TO_REVALIDATE) {
    revalidatePath(path)
  }
}

export async function saveClient(
  input: ClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, saveClientMutation)
}

export async function softDeleteClient(
  input: DeleteClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, softDeleteClientMutation)
}

export async function restoreClient(
  input: RestoreClientInput
): Promise<ClientActionResult> {
  return runClientMutation(input, restoreClientMutation)
}

async function runClientMutation<TInput>(
  input: TInput,
  mutate: (
    context: ClientMutationContext,
    payload: TInput
  ) => Promise<ClientMutationResult>
): Promise<ClientActionResult> {
  const user = await requireUser()
  const mutationResult = await mutate({ user }, input)
  const { didMutate, ...result } = mutationResult

  if (didMutate) {
    revalidateClientPaths()
  }

  return result
}

/**
 * Fetches all data needed for the company's Billing tab pickers.
 */
export async function getClientSheetContactData(
  companyId?: string
): Promise<ClientSheetContactData> {
  const user = await requireUser()
  return getContactData(user, companyId)
}

/**
 * Syncs who has portal access to a client (adds new, removes unlinked). The
 * primary contact is the company's, set on the company sheet.
 */
export async function syncClientContacts(
  companyId: string,
  contactIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser()
  const result = await syncContacts(user, companyId, contactIds)

  if (result.ok) {
    revalidateClientPaths()
  }

  return result
}
