import { z } from 'zod'

import { CLIENT_BILLING_TYPE_VALUES } from '@/lib/companies/billing/billing-types'

import { saveCompanySchema } from './schema'

/** Which month a billing start, stop or restart takes effect. */
export const billingEffectiveSchema = z.enum(['current_month', 'next_month'])

/** The company sheet's billing fields, as one save writes them. */
export const companyBillingFieldsSchema = z.object({
  billingType: z.enum(CLIENT_BILLING_TYPE_VALUES),
  /** When a changed billing type starts (ignored when unchanged). */
  billingEffective: billingEffectiveSchema.default('next_month'),
  state: z
    .string()
    .max(2)
    .nullish()
    .transform(value => (value ? value : null)),
  /** Omitted keeps the company's slug. */
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      'Slugs can only contain lowercase letters, numbers, and dashes'
    )
    .nullish()
    .transform(value => (value ? value : null)),
  originationUserId: z.string().uuid().nullable(),
  originationContactId: z.string().uuid().nullable(),
  closers: z
    .array(
      z.object({
        kind: z.enum(['user', 'contact']),
        id: z.string().uuid(),
        sharePercent: z.number(),
      })
    )
    .max(20),
  /** When a changed origination or closer split starts (ignored when unchanged). */
  commissionEffective: billingEffectiveSchema.default('next_month'),
})

/**
 * What one Save does to the company's billing: nothing, start it (makes the
 * company a client), edit it, stop it, or restart a stopped (or stopping)
 * client.
 */
export const companyBillingIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('start'),
    effective: billingEffectiveSchema,
    fields: companyBillingFieldsSchema,
  }),
  z.object({ kind: z.literal('update'), fields: companyBillingFieldsSchema }),
  z.object({ kind: z.literal('stop'), effective: billingEffectiveSchema }),
  z.object({
    kind: z.literal('restart'),
    effective: billingEffectiveSchema,
    fields: companyBillingFieldsSchema.optional(),
  }),
])

/**
 * Everything the company sheet's Save writes, in one transaction: the
 * company and its people, its billing, and who has portal access.
 */
export const saveCompanySheetSchema = saveCompanySchema.extend({
  billing: companyBillingIntentSchema.default({ kind: 'none' }),
  /**
   * Everyone at the company who can see it in the client portal after this
   * save (people joining included). Omitted leaves access as it is; turning
   * it on for someone without a sign-in gives them one.
   */
  portalAccessContactIds: z.array(z.string().uuid()).max(500).optional(),
  /**
   * The company's `updated_at` as the sheet loaded it (edits). A save made
   * since then refuses this one instead of overwriting it.
   */
  expectedUpdatedAt: z.string().max(64).optional(),
})

export type SaveCompanySheetInput = z.input<typeof saveCompanySheetSchema>
export type CompanyBillingIntent = z.input<typeof companyBillingIntentSchema>
export type CompanyBillingFields = z.input<typeof companyBillingFieldsSchema>
export type BillingEffectiveValue = z.infer<typeof billingEffectiveSchema>
