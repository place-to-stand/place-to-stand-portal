import { z } from 'zod'

export const leadConversionSchema = z.object({
  leadId: z.string().uuid(),
  clientName: z.string().min(1).max(255).optional(),
  clientSlug: z.string().max(100).optional(),
  billingType: z.enum(['prepaid', 'net_30']),
  copyNotesToClient: z.boolean().default(true),
  memberIds: z.array(z.string().uuid()).optional(),
})

export type LeadConversionFormValues = z.infer<typeof leadConversionSchema>
