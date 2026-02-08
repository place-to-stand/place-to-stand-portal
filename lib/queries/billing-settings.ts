import 'server-only'

import { eq, sql } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'

import { db } from '@/lib/db'
import { billingSettings } from '@/lib/db/schema'
import { BILLING_SETTINGS_ID } from '@/lib/billing/constants'

export type BillingSettings = InferSelectModel<typeof billingSettings>

export async function fetchBillingSettings(): Promise<BillingSettings | null> {
  const rows = await db
    .select()
    .from(billingSettings)
    .where(eq(billingSettings.id, BILLING_SETTINGS_ID))
    .limit(1)

  return rows[0] ?? null
}

type UpdateBillingSettingsInput = Partial<{
  hourlyRate: string
  invoicePrefix: string
  companyName: string | null
  companyAddress: string | null
  companyPhone: string | null
  companyEmail: string | null
  paymentTermsDays: number
  updatedBy: string
}>

export async function updateBillingSettings(
  data: UpdateBillingSettingsInput
): Promise<BillingSettings> {
  const [settings] = await db
    .insert(billingSettings)
    .values({
      id: BILLING_SETTINGS_ID,
      ...data,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .onConflictDoUpdate({
      target: billingSettings.id,
      set: {
        ...data,
        updatedAt: sql`timezone('utc'::text, now())`,
      },
    })
    .returning()

  return settings
}
