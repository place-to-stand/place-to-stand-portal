import { z } from 'zod'

import { linkedinUrlSchema } from '@/lib/companies/schema'

export const contactSchema = z.object({
  id: z.string().uuid().optional(),
  /** Optional: a contact can be just a name. Blank is stored as null. */
  email: z
    .union([z.string().trim().email('Enter a valid email'), z.literal('')])
    .optional()
    .nullable()
    .transform(value => (value ? value : null)),
  name: z.string().min(1, 'Name is required').max(160),
  phone: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform(value => (value?.trim() ? value.trim() : null)),
  // Sales profile. Omitted (undefined) keeps the stored value, so callers
  // that only know name, email and phone don't wipe it.
  jobTitle: z
    .string()
    .max(160)
    .optional()
    .nullable()
    .transform(value =>
      value === undefined ? undefined : value?.trim() ? value.trim() : null
    ),
  linkedinUrl: linkedinUrlSchema.optional(),
  /**
   * The linked company (the sheet's picker). When present it wins over
   * `companyName`; null clears it.
   */
  companyId: z.string().uuid().nullable().optional(),
  /** Company by name (CLI, MCP): matched case-insensitively, created when new. */
  companyName: z
    .string()
    .max(160)
    .optional()
    .nullable()
    .transform(value =>
      value === undefined ? undefined : value?.trim() ? value.trim() : null
    ),
  isChampion: z.boolean().optional(),
})

const contactIdentifierSchema = {
  id: z.string().uuid(),
}

export const deleteContactSchema = z.object(contactIdentifierSchema)
export const restoreContactSchema = z.object(contactIdentifierSchema)
export const destroyContactSchema = z.object(contactIdentifierSchema)

export type ContactInput = z.infer<typeof contactSchema>
export type DeleteContactInput = z.infer<typeof deleteContactSchema>
export type RestoreContactInput = z.infer<typeof restoreContactSchema>
export type DestroyContactInput = z.infer<typeof destroyContactSchema>

export type ContactActionResult = {
  error?: string
  id?: string
}
