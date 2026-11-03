import 'server-only'

import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import type { DbTx } from '@/lib/db'
import { leads } from '@/lib/db/schema'

/**
 * A Won lead whose company is already a client is converted: nothing more
 * to start. Run after any write that can win a lead or change its company.
 * Making a company a client (admin-only) stamps its Won leads too
 * (`create-client.ts`); this covers the lead won after that.
 */
export async function markConvertedIfClient(
  tx: DbTx,
  leadId: string,
  at: string
) {
  await tx
    .update(leads)
    .set({ convertedAt: at })
    .where(
      and(
        eq(leads.id, leadId),
        eq(leads.status, 'CLOSED_WON'),
        isNull(leads.convertedAt),
        isNull(leads.deletedAt),
        isNotNull(leads.companyId),
        sql`company_is_client(${leads.companyId})`
      )
    )
}
