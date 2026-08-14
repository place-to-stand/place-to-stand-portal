import { z } from 'zod'

import { LEAD_STATUS_VALUES, type LeadStatusValue } from '@/lib/leads/constants'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'
import type { LeadStaleThresholdSource } from '@/lib/leads/updates'

export const leadFormSchema = z.object({
  contactName: z.string().trim().min(1, 'Contact name is required').max(160),
  contactEmail: z
    .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  companyWebsite: z
    .union([z.string().trim().url('Enter a valid URL'), z.literal('')])
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
  // Origination mirrors the clients model (D13). The mutex is enforced in the
  // save action as well as the database, so a constraint violation is never the
  // user-facing error.
  originationMode: z.enum(['internal', 'external']).optional().nullable(),
  originationContactId: z.string().uuid().optional().nullable(),
  originationUserId: z.string().uuid().optional().nullable(),
  status: z.enum(LEAD_STATUS_VALUES),
  assigneeId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

export type LeadSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadRecord | null
  initialStatus?: LeadStatusValue | null
  initialAction?: string | null
  assignees: LeadAssigneeOption[]
  canManage?: boolean
  senderName?: string
  onSuccess: () => void
  /** Called with the new lead's ID after successful creation (not editing) */
  onCreated?: (leadId: string) => void
  /**
   * Configured staleness thresholds, passed through to the updates section so
   * the follow-up shortcut can prefill a due date (D24). Optional: absent, the
   * section falls back to LEAD_STALE_AFTER_DAYS (C14).
   */
  thresholds?: LeadStaleThresholdSource
  /** Pre-fill form fields when creating a new lead (ignored when editing) */
  initialValues?: Partial<Pick<LeadFormValues, 'contactName' | 'contactEmail' | 'companyName' | 'notes'>>
}
