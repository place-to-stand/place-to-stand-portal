'use server'

import { requireUser } from '@/lib/auth/session'
import {
  getClientSheetContactData as getContactData,
  type ClientSheetContactData,
} from '@/lib/queries/clients/settings/client-contacts'

/**
 * Fetches all data needed for the company's Billing tab pickers.
 */
export async function getClientSheetContactData(
  companyId?: string
): Promise<ClientSheetContactData> {
  const user = await requireUser()
  return getContactData(user, companyId)
}
