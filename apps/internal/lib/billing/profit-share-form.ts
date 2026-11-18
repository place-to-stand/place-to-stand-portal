import { z } from 'zod'

/**
 * The Profit share form (Settings → Billing), shared by the page and its save
 * action so both check the same rules. It stays off until a start month and
 * at least one person are set.
 */
export const profitShareSettingsSchema = z.object({
  /** YYYY-MM, or '' for off. */
  profitShareStartMonth: z
    .string()
    .trim()
    .refine(
      value => value === '' || /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(value),
      {
        message: 'Pick a month.',
      }
    ),
  profitShareMinimumBalance: z
    .string()
    .trim()
    .refine(value => value === '' || /^\d{1,10}(\.\d{1,2})?$/.test(value), {
      message: 'Enter an amount in dollars, like 10000.',
    }),
  profitSharePartnerIds: z.array(z.guid()).max(20),
})

export type ProfitShareSettingsInput = z.input<typeof profitShareSettingsSchema>
export type ProfitShareSettingsValues = z.output<
  typeof profitShareSettingsSchema
>
