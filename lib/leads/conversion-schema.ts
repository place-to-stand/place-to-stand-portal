import { z } from 'zod'

export const leadConversionSchema = z.object({
  leadId: z.string().uuid(),
  clientName: z.string().min(1).max(255).optional(),
  clientSlug: z.string().max(100).optional(),
  billingType: z.enum(['prepaid', 'net_30']),
  copyNotesToClient: z.boolean(),
  memberIds: z.array(z.string().uuid()).optional(),
})

/** Form input type (before validation) */
export type LeadConversionFormValues = z.input<typeof leadConversionSchema>

/** Validated output type (after parsing) */
export type LeadConversionData = z.output<typeof leadConversionSchema>
