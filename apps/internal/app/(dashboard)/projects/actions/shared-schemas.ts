import { z } from 'zod'

import { ACCEPTED_TASK_ATTACHMENT_MIME_TYPES } from '@/lib/storage/task-attachment-constants'

export const TASK_STATUSES = [
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
] as const

export const statusSchema = z.enum(TASK_STATUSES)

const attachmentToAttachSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1),
  // The allowlist the upload route enforces: the download route serves
  // this type back, so a free-form value (text/html) would be stored XSS.
  mimeType: z
    .string()
    .refine(
      value =>
        (ACCEPTED_TASK_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
          value
        ),
      'Unsupported attachment type.'
    ),
  fileSize: z.number().int().min(1),
})

const attachmentsSchema = z.object({
  toAttach: z.array(attachmentToAttachSchema).default([]),
  toRemove: z.array(z.string().uuid()).default([]),
})

export const baseTaskSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: statusSchema.default('ON_DECK'),
  dueOn: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  attachments: attachmentsSchema.optional(),
})

export type BaseTaskInput = z.infer<typeof baseTaskSchema>
export type AttachmentPayload = z.infer<typeof attachmentsSchema>
