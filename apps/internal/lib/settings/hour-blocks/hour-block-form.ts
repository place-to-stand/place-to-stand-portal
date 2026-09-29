import { z } from 'zod'

const DEFAULT_HOURS_PURCHASED = 5

export const HOUR_BLOCK_NOTES_MAX_LENGTH = 2000

export const hourBlockFormSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z.coerce
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  notes: z
    .string()
    .trim()
    .max(
      HOUR_BLOCK_NOTES_MAX_LENGTH,
      `Notes must be ${HOUR_BLOCK_NOTES_MAX_LENGTH} characters or fewer.`
    ),
})

export type HourBlockFormValues = z.infer<typeof hourBlockFormSchema>

type HourBlockRow = {
  id: string
  client_id: string
  hours_purchased: number
  invoice_id: string | null
  /**
   * The invoice_* fields are read from the linked invoice at query time — not
   * stored on the block. The link itself is set only when an invoice creates
   * the block, and never changes after.
   */
  invoice_number: string | null
  invoice_status: string | null
  invoice_total: number | null
  invoice_issued_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Month the block's hours are billed in ('yyyy-MM-dd', PRD 002 D13). */
  billing_month: string
}

type ClientRow = {
  id: string
  name: string
  deleted_at: string | null
}

export type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

export const HOUR_BLOCK_FORM_FIELDS: Array<keyof HourBlockFormValues> = [
  'clientId',
  'hoursPurchased',
  'notes',
]

export const buildHourBlockFormDefaults = (
  hourBlock: HourBlockWithClient | null
): HourBlockFormValues => ({
  clientId: hourBlock?.client_id ?? '',
  hoursPurchased: hourBlock?.hours_purchased ?? DEFAULT_HOURS_PURCHASED,
  notes: hourBlock?.notes ?? '',
})

export type HourBlockSavePayload = {
  id?: string
  clientId: string
  hoursPurchased: number
  notes: string | null
}

export const createHourBlockSavePayload = (
  values: HourBlockFormValues,
  hourBlock: HourBlockWithClient | null
): HourBlockSavePayload => ({
  id: hourBlock?.id,
  clientId: values.clientId,
  hoursPurchased: values.hoursPurchased,
  notes: values.notes.trim().length > 0 ? values.notes.trim() : null,
})

export const sortClientsByName = (clients: ClientRow[]): ClientRow[] =>
  [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

export type { ClientRow }
