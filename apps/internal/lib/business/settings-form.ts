import { z } from 'zod'

/**
 * The Business page form (Settings → Business), shared by the page and its
 * save action so both check the same rules.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform(value => value || null)
    .nullable()

const optionalEmail = z
  .string()
  .trim()
  .transform(value => value || null)
  .nullable()
  .refine(value => value === null || z.email().safeParse(value).success, {
    message: 'Enter an email address.',
  })

const optionalUrl = z
  .string()
  .trim()
  .transform(value => value || null)
  .nullable()
  .refine(value => value === null || /^https?:\/\/\S+\.\S+/i.test(value), {
    message: 'Enter a full link, starting with https://',
  })

/** Unchanged, replaced with a new upload (a data URL), or removed. */
const imageChange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('keep') }),
  z.object({ kind: z.literal('replace'), dataUrl: z.string().min(1) }),
  z.object({ kind: z.literal('remove') }),
])

export type BusinessImageChange = z.infer<typeof imageChange>

export const businessSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the business name.')
    .max(120, 'Keep this under 120 characters.')
    // It is the email sender name: a line break would break every From header.
    .refine(value => !/[\u0000-\u001f\u007f]/.test(value), {
      message: 'Keep the name on one line.',
    }),
  legalName: optionalText(160),
  website: optionalUrl,
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(100),
  region: optionalText(100),
  postalCode: optionalText(20),
  country: optionalText(100),
  phone: optionalText(40),
  inboxEmail: optionalEmail,
  sendingEmail: optionalEmail,
  bookingUrl: optionalUrl,
  timeZone: z.string().min(1, 'Pick a time zone.'),
  logo: imageChange,
  icon: imageChange,
})

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>
export type BusinessSettingsValues = z.output<typeof businessSettingsSchema>

/** Labels for the activity log's list of changed text fields. */
export const BUSINESS_FIELD_LABELS: Record<
  Exclude<keyof BusinessSettingsValues, 'logo' | 'icon'>,
  string
> = {
  name: 'name',
  legalName: 'legal name',
  website: 'website',
  addressLine1: 'address',
  addressLine2: 'address line 2',
  city: 'city',
  region: 'state',
  postalCode: 'postal code',
  country: 'country',
  phone: 'phone',
  inboxEmail: 'inbox email',
  sendingEmail: 'sending email',
  bookingUrl: 'booking link',
  timeZone: 'time zone',
}
