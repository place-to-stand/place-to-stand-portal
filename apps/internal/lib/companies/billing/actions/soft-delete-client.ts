import {
  stopBilling,
  type BillingEffective,
} from '@/lib/companies/billing/periods'

import type { DbTx } from '@/lib/db'

/**
 * Stops a client's billing inside the caller's transaction (this month or
 * after it). Portal access is left alone: the `client_portal_access` view
 * only lets people in while billing is open, so access ends when billing
 * does (at the end of this month for a stop after it), and a restart gives
 * it back to exactly the people whose portal switch is on. Archiving the
 * company is what switches those off.
 */
export async function stopClientBillingInTx(
  tx: DbTx,
  input: { companyId: string; effective: BillingEffective }
): Promise<void> {
  await stopBilling(tx, input)
}
