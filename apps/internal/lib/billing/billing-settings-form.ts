import { z } from 'zod'

import { profitShareSettingsSchema } from './profit-share-form'

/**
 * Settings → Billing as one form: the product catalog, the tax rates and the
 * profit share, saved together by the page's Save. Rows keep the shape the
 * queries return (`ProductCatalogItemRow`, `TaxRateRow`); a new row's id is
 * local (`new-…`) until Save creates it.
 */

const rowId = z.string().min(1).max(64)

export const billingProductRowSchema = z.object({
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
  min_quantity: z.number().int().min(0).nullable(),
  sort_order: z.number().int().min(0),
})

export const billingTaxRateRowSchema = z.object({
  id: rowId,
  state: z.string().trim().min(1, 'State is required').max(50),
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

export const billingSettingsSchema = profitShareSettingsSchema.extend({
  products: z.array(billingProductRowSchema).max(500),
  taxRates: z.array(billingTaxRateRowSchema).max(200),
})

export type BillingSettingsInput = z.input<typeof billingSettingsSchema>
export type BillingSettingsValues = z.output<typeof billingSettingsSchema>
