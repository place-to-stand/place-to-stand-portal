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
  /** Rich text (TipTap HTML), as the sheet's editor produces it. */
  notes: optionalText(20000),
  /**
   * People staged on the sheet's People list (edit only). Adding someone at
   * another company keeps them there too; removing someone ends their
   * membership here (and with it portal access to this company's client).
   */
  addContactIds: z.array(z.string().uuid()).max(500).optional(),
  removeContactIds: z.array(z.string().uuid()).max(500).optional(),
  /**
   * The client linked in the sheet's Linked client slot (edit only, admin
   * only). One linked elsewhere moves here and is renamed to match. A
   * company has one client.
   */
  addClientIds: z.array(z.string().uuid()).max(1).optional(),
  /**
   * Titles at this company, set on the Contacts list (edit only): for
   * current members and people joining in this save. Blank clears it.
   */
  contactTitles: z
    .array(
      z.object({
        contactId: z.string().uuid(),
        title: z
          .string()
          .trim()
          .max(160)
          .transform(value => (value ? value : null)),
      })
    )
    .max(500)
    .optional(),
  /** The linked client to unlink (admin only); it keeps its own records. */
  unlinkClientIds: z.array(z.string().uuid()).max(1).optional(),
})

export type SaveCompanyInput = z.input<typeof saveCompanySchema>
export type SaveCompanyValues = z.output<typeof saveCompanySchema>

export const linkedinUrlSchema = optionalUrl(255)
export const normalizeWebAddress = (value: string | null | undefined) => {
  const parsed = optionalUrl(255).safeParse(value)
  return parsed.success ? parsed.data : null
}
