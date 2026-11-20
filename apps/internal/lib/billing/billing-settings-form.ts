import { z } from 'zod'

import { profitShareSettingsSchema } from './profit-share-form'

/**
 * Settings → Billing as one form: the product catalog, the tax rates and the
 * profit share, saved together by the page's Save. Rows keep the shape the
 * queries return (`ProductCatalogItemRow`, `TaxRateRow`); a new row's id is
 * local (`new-…`) until Save creates it.
 */

/** A saved row's uuid, or a new row's local `new-<uuid>`. */
const rowId = z.union([
  z.guid(),
  z.string().regex(/^new-[0-9a-f-]{36}$/i, 'Unknown row'),
])

/** Postgres `integer`. */
const INT_MAX = 2147483647

const billingProductRowSchema = z.object({
  id: rowId,
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullable(),
  unit_price: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a unit price, like 200.00'),
  unit_label: z.string().trim().min(1, 'Unit label is required').max(50),
  creates_hour_block_default: z.boolean(),
  is_active: z.boolean(),
  min_quantity: z.number().int().min(0).max(INT_MAX).nullable(),
  sort_order: z.number().int().min(0).max(INT_MAX),
})

const billingTaxRateRowSchema = z.object({
  id: rowId,
  state: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'Pick a state'),
  rate: z
    .string()
    .trim()
    .refine(value => {
      const rate = Number(value)
      return value !== '' && Number.isFinite(rate) && rate >= 0 && rate < 1
    }, 'Enter a rate between 0 and 100%'),
  label: z.string().trim().min(1, 'Label is required').max(100),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const billingSettingsFields = profitShareSettingsSchema.extend({
  products: z.array(billingProductRowSchema).max(500),
  taxRates: z.array(billingTaxRateRowSchema).max(200),
})

/** The database allows one tax rate per state. */
function uniqueStates(
  value: { taxRates: { state: string }[] },
  ctx: z.RefinementCtx
) {
  const seen = new Set<string>()
  value.taxRates.forEach((rate, index) => {
    if (seen.has(rate.state)) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxRates', index, 'state'],
        message: `${rate.state} already has a tax rate`,
      })
    }
    seen.add(rate.state)
  })
}

export const billingSettingsSchema =
  billingSettingsFields.superRefine(uniqueStates)

export type BillingSettingsInput = z.input<typeof billingSettingsSchema>
export type BillingSettingsValues = z.output<typeof billingSettingsSchema>

// ---------------------------------------------------------------------------
// What Save sends: the form, plus what it started from
// ---------------------------------------------------------------------------

/** A product as the page loaded it (only the fields Save compares). */
export const productBaseSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  unit_price: z.string(),
  unit_label: z.string(),
  creates_hour_block_default: z.boolean(),
  is_active: z.boolean(),
  min_quantity: z.number().nullable(),
  sort_order: z.number(),
})

/** A tax rate as the page loaded it (only the fields Save compares). */
export const taxRateBaseSchema = z.object({
  state: z.string(),
  rate: z.string(),
  label: z.string(),
  is_active: z.boolean(),
})

/**
 * Save sends each saved row as the page loaded it, so the server writes only
 * what this page changed and refuses a row someone else changed meanwhile,
 * instead of quietly reverting their edit.
 */
export const billingSavePayloadSchema = billingSettingsFields
  .extend({
    productBases: z.record(z.guid(), productBaseSchema),
    taxRateBases: z.record(z.guid(), taxRateBaseSchema),
    profitShareBase: profitShareSettingsSchema,
  })
  .superRefine(uniqueStates)

export type BillingSavePayloadInput = z.input<typeof billingSavePayloadSchema>
export type BillingSavePayload = z.output<typeof billingSavePayloadSchema>

/** One shape for "is this the same product?", whatever the source. */
export function productKey(row: z.input<typeof productBaseSchema>): string {
  return JSON.stringify([
    row.name.trim(),
    row.description?.trim() || null,
    Number(row.unit_price).toFixed(2),
    row.unit_label.trim(),
    row.creates_hour_block_default,
    row.is_active,
    row.min_quantity ?? null,
    row.sort_order,
  ])
}

/** One shape for "is this the same tax rate?", whatever the source. */
export function taxRateKey(row: z.input<typeof taxRateBaseSchema>): string {
  return JSON.stringify([
    row.state,
    Number(row.rate),
    row.label.trim(),
    row.is_active,
  ])
}

/** One shape for "is this the same profit share?". */
export function profitShareKey(
  row: z.input<typeof profitShareSettingsSchema>
): string {
  return JSON.stringify([
    row.profitShareStartMonth.trim(),
    Number(row.profitShareMinimumBalance || 0),
    row.profitSharePartnerIds.join(),
  ])
}
