import { z } from 'zod'

import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_VALUES,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { PRIORITY_TIERS } from '@/lib/leads/intelligence-types'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'

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
  sourceType: z.enum(LEAD_SOURCE_TYPES).optional().nullable(),
  sourceDetail: z.string().trim().max(160).optional().nullable(),
  status: z.enum(LEAD_STATUS_VALUES),
  assigneeId: z.string().uuid().optional().nullable(),
  estimatedValue: z
    .string()
    .trim()
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
  notes: z.string().optional(),
  priorityTier: z.enum(PRIORITY_TIERS).optional().nullable(),
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
}
