import { z } from 'zod'

export const contactSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required').max(160),
  phone: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform(value => (value?.trim() ? value.trim() : null)),
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
