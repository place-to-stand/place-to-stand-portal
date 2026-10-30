import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, leads } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { insertInitialBillingTerm } from '@/lib/queries/clients/billing-terms'
import {
  startBilling,
  type BillingEffective,
} from '@/lib/companies/billing/periods'
import { insertInitialCommissionTerm } from '@/lib/queries/clients/commission-terms'
import type { CloserShare } from '@/lib/companies/billing/closers'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Makes a company a client inside the caller's transaction: its slug and
 * state, a billing period from this month (or next), and its first billing
 * and commission terms (a client without terms is invisible to every
 * monthly close). Won leads at the company count as converted. A slug that
 * another company took meanwhile fails with a unique violation.
 */
export async function startClientBillingInTx(
  tx: DbTransaction,
  input: {
    companyId: string
    slug: string
    state: string | null
    billingType: ClientBillingTypeValue
    originationUserId: string | null
    originationContactId: string | null
    closers: CloserShare[]
    effective: BillingEffective
    actorId: string
  }
): Promise<void> {
  const { companyId } = input
  const now = new Date().toISOString()
  await tx
    .update(companies)
    .set({ slug: input.slug, state: input.state, updatedAt: now })
    .where(eq(companies.id, companyId))
  await startBilling(tx, {
    companyId,
    effective: input.effective,
    actorId: input.actorId,
  })
  await insertInitialBillingTerm(tx, {
    companyId: companyId,
    billingType: input.billingType,
    createdBy: input.actorId,
  })
  // Same atomicity for the commission split (PRD 007): the client's first
  // month must resolve its closers/origination.
  await insertInitialCommissionTerm(tx, {
    companyId: companyId,
    closers: input.closers,
    originationUserId: input.originationUserId,
    originationContactId: input.originationContactId,
    createdBy: input.actorId,
  })
  // Won leads at this company are converted: it became the client.
  await tx
    .update(leads)
    .set({ convertedAt: now })
    .where(
      and(
        eq(leads.companyId, companyId),
        eq(leads.status, 'CLOSED_WON'),
        isNull(leads.convertedAt),
        isNull(leads.deletedAt)
      )
    )
}
