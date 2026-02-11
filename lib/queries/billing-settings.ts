import 'server-only'

import { cache } from 'react'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { billingSettings } from '@/lib/db/schema'
import { BILLING_SETTINGS_ID } from '@/lib/billing/constants'
import type { BillingSettings } from '@/lib/invoices/types'

/**
 * Fetch the singleton billing settings row.
 * Cached per-request via React cache().
 */
export const fetchBillingSettings = cache(
  async (): Promise<BillingSettings | null> => {
    const [row] = await db
      .select()
      .from(billingSettings)
      .where(eq(billingSettings.id, BILLING_SETTINGS_ID))
      .limit(1)

    return row ?? null
  }
)

/**
 * Update billing settings (upsert — creates if not exists).
 */
export async function updateBillingSettings(
  data: Partial<
    Pick<
      BillingSettings,
      | 'hourlyRate'
      | 'companyName'
      | 'companyAddress'
      | 'companyLogoUrl'
      | 'defaultPaymentTermsDays'
      | 'invoiceNumberPrefix'
      | 'updatedBy'
    >
  >
): Promise<BillingSettings> {
  const [result] = await db
    .insert(billingSettings)
    .values({
      id: BILLING_SETTINGS_ID,
      ...data,
    })
    .onConflictDoUpdate({
      target: billingSettings.id,
      set: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()

  return result
}
