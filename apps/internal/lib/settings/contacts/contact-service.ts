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
  linkedinUrl: linkedinUrlSchema.optional(),
  /**
   * Every company the person belongs to (the sheet's Companies list), with
   * their title at each. Portal access is set on the client, not here. When present it is the full set:
   * missing companies are left (history kept), new ones joined. Omitted
   * keeps their companies as they are.
   */
  companies: z
    .array(
      z.object({
        companyId: z.string().uuid(),
        // Omitted keeps their title; blank clears it.
        title: z
          .string()
          .max(160)
          .nullable()
          .optional()
          .transform(value =>
            value === undefined
              ? undefined
              : value?.trim()
                ? value.trim()
                : null
          ),
      })
    )
    .max(50)
    .optional(),
  /**
   * Shorthand for one company (CLI, MCP, create-from-picker): joins it if
   * they aren't a member yet, keeping their other companies. `companyId`
   * wins over `companyName` (matched case-insensitively, created when new).
   */
  companyId: z.string().uuid().nullable().optional(),
  companyName: z
    .string()
    .max(160)
    .optional()
    .nullable()
    .transform(value =>
      value === undefined ? undefined : value?.trim() ? value.trim() : null
    ),
  /** Their title at that one company (with `companyId`/`companyName`). */
  jobTitle: z
    .string()
    .max(160)
    .optional()
    .nullable()
    .transform(value =>
      value === undefined ? undefined : value?.trim() ? value.trim() : null
    ),
})

const contactIdentifierSchema = {
  id: z.string().uuid(),
}

export const deleteContactSchema = z.object(contactIdentifierSchema)
export const restoreContactSchema = z.object(contactIdentifierSchema)

export type ContactInput = z.input<typeof contactSchema>
export type DeleteContactInput = z.infer<typeof deleteContactSchema>
export type RestoreContactInput = z.infer<typeof restoreContactSchema>

export type ContactActionResult = {
  error?: string
  id?: string
}
