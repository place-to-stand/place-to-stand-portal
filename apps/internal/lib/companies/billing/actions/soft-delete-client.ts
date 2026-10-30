import {
  stopBilling,
  type BillingEffective,
} from '@/lib/companies/billing/periods'

import { db } from '@/lib/db'
import { type ContactClientLinkChange } from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { revokeCompanyPortalAccess } from '@/lib/companies/billing/revoke-company-portal-access'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Stops a client's billing inside the caller's transaction (this month or
 * after it) and switches off its people's portal access, so a restart
 * doesn't silently bring it back. Returns the access trail to log once the
 * transaction committed.
 */
export async function stopClientBillingInTx(
  tx: DbTransaction,
  input: { companyId: string; effective: BillingEffective }
): Promise<ContactClientLinkChange[]> {
  await stopBilling(tx, input)
  return revokeCompanyPortalAccess(tx, input.companyId, input.companyId)
}
