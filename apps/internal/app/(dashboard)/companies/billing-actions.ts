'use server'

import { requireUser } from '@/lib/auth/session'
import {
  getClientSheetContactData as getContactData,
  type ClientSheetContactData,
} from '@/lib/queries/companies/billing/settings/client-contacts'

/**
 * Loads the options for the billing pickers in the company sheet's Client column.
 */
export async function getClientSheetContactData(
  companyId?: string
): Promise<ClientSheetContactData> {
  const user = await requireUser()
  return getContactData(user, companyId)
}
