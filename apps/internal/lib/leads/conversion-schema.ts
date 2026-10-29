import { z } from 'zod'

export const leadConversionSchema = z
  .object({
    leadId: z.string().uuid(),
    clientName: z.string().min(1).max(255).optional(),
    clientSlug: z.string().max(100).optional(),
    billingType: z.enum(['prepaid', 'net_30']),
    copyNotesToClient: z.boolean(),
    /** The lead's person can see the client in the portal (off by default). */
    givePortalAccess: z.boolean().default(false),
    createProject: z.boolean().default(false),
    projectName: z.string().max(200).optional(),
    existingClientId: z.string().uuid().optional(),
  })
  .refine(
    data =>
      !data.createProject ||
      (data.projectName && data.projectName.trim().length > 0),
    {
      message: 'Project name is required when creating a project',
      path: ['projectName'],
    }
  )

/** Form input type (before validation) */
export type LeadConversionFormValues = z.input<typeof leadConversionSchema>
