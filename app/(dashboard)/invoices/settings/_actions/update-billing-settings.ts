'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { updateBillingSettings } from '@/lib/queries/billing-settings'

export type UpdateBillingSettingsResult = {
  success: boolean
  error?: string
}

export async function updateBillingSettingsAction(input: {
  hourlyRate?: string
  invoicePrefix?: string
  companyName?: string | null
  companyAddress?: string | null
  companyPhone?: string | null
  companyEmail?: string | null
  paymentTermsDays?: number
}): Promise<UpdateBillingSettingsResult> {
  const user = await requireUser()
  assertAdmin(user)

  await updateBillingSettings({
    ...input,
    updatedBy: user.id,
  })

  revalidatePath('/invoices')
  revalidatePath('/invoices/settings')
  return { success: true }
}
