import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform(value => (value ? value : null))

/** Accepts a bare domain ("acme.com") and stores it with a scheme. */
const optionalUrl = (max: number) =>
  optionalText(max).transform((value, ctx) => {
    if (!value) return null
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
    try {
      const url = new URL(withScheme)
      if (!url.hostname.includes('.')) throw new Error('no dot')
      return url.toString().replace(/\/$/, '')
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid web address' })
      return z.NEVER
    }
  })

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, 'Company name is required')
  .max(160, 'Company name must be 160 characters or fewer')

export const saveCompanySchema = z.object({
  id: z.string().uuid().optional(),
  name: companyNameSchema,
  website: optionalUrl(255),
  linkedinUrl: optionalUrl(255),
  notes: optionalText(5000),
  ownerId: z.string().uuid().nullable().optional(),
})

export type SaveCompanyInput = z.input<typeof saveCompanySchema>
export type SaveCompanyValues = z.output<typeof saveCompanySchema>

export const linkedinUrlSchema = optionalUrl(255)
export const normalizeWebAddress = (value: string | null | undefined) => {
  const parsed = optionalUrl(255).safeParse(value)
  return parsed.success ? parsed.data : null
}
