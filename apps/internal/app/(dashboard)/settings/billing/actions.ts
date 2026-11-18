'use server'

import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity/logger'
import {
  productCatalogItemCreatedEvent,
  productCatalogItemUpdatedEvent,
  taxRateCreatedEvent,
  taxRateUpdatedEvent,
} from '@/lib/activity/events'
import type { ActivityEvent } from '@/lib/activity/types'
import { requirePage, type AppUser } from '@/lib/auth/session'
import {
  billingSettingsSchema,
  type BillingSettingsInput,
  type BillingSettingsValues,
} from '@/lib/billing/billing-settings-form'
import { db } from '@/lib/db'
import {
  createProductCatalogItem,
  getProductCatalogItemById,
  updateProductCatalogItem,
  type ProductCatalogItemRow,
} from '@/lib/queries/product-catalog'
import {
  createTaxRate,
  getTaxRateById,
  updateTaxRate,
} from '@/lib/queries/tax-rates'

import {
  describeIssues,
  diffRows,
  partnersAreStaff,
  PRODUCT_FIELDS,
  saveProfitShare,
  TAX_RATE_FIELDS,
  type ProfitShareFieldErrors,
} from './_lib/save-billing'

async function logSettingsEvent(
  user: AppUser,
  targetId: string | null,
  event: ActivityEvent
) {
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'SETTINGS',
    targetId,
    metadata: event.metadata,
  })
}

// ---------------------------------------------------------------------------
// Save the whole page
// ---------------------------------------------------------------------------

export type SaveBillingSettingsResult =
  | { ok: true }
  | {
      ok: false
      error: string
      /** Profit share field errors, by field. */
      fieldErrors?: ProfitShareFieldErrors
    }

const NEW_ROW = /^new-/

class RowNotFoundError extends Error {}

/**
 * Saves Settings → Billing in one transaction: products and tax rates
 * created or changed, then the profit share. Nothing on the page writes
 * before this; closed months keep the profit share frozen in their snapshot.
 */
export async function saveBillingSettings(
  input: BillingSettingsInput
): Promise<SaveBillingSettingsResult> {
  const user = await requirePage('billing.manage')

  const parsed = billingSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, ...describeIssues(parsed.error.issues, input) }
  }
  const values = parsed.data

  if (!(await partnersAreStaff(values.profitSharePartnerIds))) {
    return {
      ok: false,
      error: 'Check the highlighted fields.',
      fieldErrors: { profitSharePartnerIds: 'Pick partners from the list.' },
    }
  }

  const events: { targetId: string | null; event: ActivityEvent }[] = []

  try {
    await db.transaction(async tx => {
      for (const row of values.products) {
        const fields = {
          name: row.name,
          description: row.description || null,
          unitPrice: row.unit_price,
          unitLabel: row.unit_label,
          createsHourBlockDefault: row.creates_hour_block_default,
          isActive: row.is_active,
          minQuantity: row.min_quantity,
          sortOrder: row.sort_order,
        }
        if (NEW_ROW.test(row.id)) {
          const created = await createProductCatalogItem(fields, tx)
          events.push({
            targetId: created.id,
            event: productCatalogItemCreatedEvent({
              name: created.name,
              unitPrice: created.unit_price,
              unitLabel: created.unit_label,
              isActive: created.is_active,
            }),
          })
          continue
        }
        const existing = await getProductCatalogItemById(row.id, tx)
        if (!existing) throw new RowNotFoundError(`Product “${row.name}”`)
        const diff = diffRows(
          existing,
          { ...existing, ...toProductRow(row) },
          PRODUCT_FIELDS
        )
        if (diff.changedFields.length === 0) continue
        const updated = await updateProductCatalogItem(row.id, fields, tx)
        if (!updated) throw new RowNotFoundError(`Product “${row.name}”`)
        events.push({
          targetId: updated.id,
          event: productCatalogItemUpdatedEvent({
            name: updated.name,
            changedFields: diff.changedFields,
            details: diff.details,
          }),
        })
      }

      for (const row of values.taxRates) {
        const fields = {
          state: row.state,
          rate: row.rate,
          label: row.label,
          isActive: row.is_active,
        }
        if (NEW_ROW.test(row.id)) {
          const created = await createTaxRate(fields, tx)
          events.push({
            targetId: created.id,
            event: taxRateCreatedEvent({
              label: created.label,
              state: created.state,
              rate: created.rate,
              isActive: created.is_active,
            }),
          })
          continue
        }
        const existing = await getTaxRateById(row.id, tx)
        if (!existing) throw new RowNotFoundError(`Tax rate “${row.label}”`)
        const next = {
          ...existing,
          state: row.state,
          label: row.label,
          is_active: row.is_active,
          rate:
            Number(existing.rate) === Number(row.rate)
              ? existing.rate
              : row.rate,
        }
        const diff = diffRows(existing, next, TAX_RATE_FIELDS)
        if (diff.changedFields.length === 0) continue
        const updated = await updateTaxRate(row.id, fields, tx)
        events.push({
          targetId: updated.id,
          event: taxRateUpdatedEvent({
            label: updated.label,
            changedFields: diff.changedFields,
            details: diff.details,
          }),
        })
      }

      const profitShare = await saveProfitShare(tx, user, values)
      if (profitShare) events.push({ targetId: null, event: profitShare })
    })
  } catch (error) {
    if (error instanceof RowNotFoundError) {
      return {
        ok: false,
        error: `${error.message} no longer exists. Reload the page and try again.`,
      }
    }
    console.error('Failed to save billing settings:', error)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  for (const { targetId, event } of events) {
    await logSettingsEvent(user, targetId, event)
  }

  revalidatePath('/settings/billing')
  revalidatePath('/reports/monthly-close')
  return { ok: true }
}

function toProductRow(
  row: BillingSettingsValues['products'][number]
): Partial<ProductCatalogItemRow> {
  return {
    name: row.name,
    description: row.description || null,
    unit_price: row.unit_price,
    unit_label: row.unit_label,
    creates_hour_block_default: row.creates_hour_block_default,
    is_active: row.is_active,
    min_quantity: row.min_quantity,
    sort_order: row.sort_order,
  }
}
