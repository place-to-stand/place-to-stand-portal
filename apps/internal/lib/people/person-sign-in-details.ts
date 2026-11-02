import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import { currentMonthStartUtc } from '@/lib/queries/companies/billing/billing-terms'
import { listClosedMonthStarts } from '@/lib/queries/reports/close-snapshots'
import {
  getPortalAccountSummary,
  type PortalAccountSummary,
} from '@/lib/queries/users/portal-account'
import { roleMonthOptions, type RoleMonthOption } from '@/lib/users/role-months'

export type PersonSignInDetails = {
  account: PortalAccountSummary | null
  roleMonths: RoleMonthOption[]
}

/**
 * A person's sign-in for the sheet (admins): the account, and the months a
 * role change can start from.
 */
export async function loadPersonSignInDetails(
  user: AppUser,
  userId: string
): Promise<PersonSignInDetails> {
  const [account, closedMonths] = await Promise.all([
    getPortalAccountSummary(user, userId),
    listClosedMonthStarts(),
  ])
  return {
    account,
    roleMonths: roleMonthOptions(currentMonthStartUtc(), closedMonths),
  }
}
