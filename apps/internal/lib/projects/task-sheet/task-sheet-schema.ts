import { z } from 'zod'

export const taskSheetFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().nullable(),
    status: z.enum(['ON_DECK', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const),
    dueOn: z.string().optional(),
    // A task is on a project or a lead, never both: the "Project or lead"
    // field sets one and clears the other.
    projectId: z.string().uuid().optional().nullable(),
    assigneeId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
  })
  .refine(values => Boolean(values.projectId) !== Boolean(values.leadId), {
    message: 'Choose a project or a lead',
    path: ['projectId'],
  })

export type TaskSheetFormValues = z.infer<typeof taskSheetFormSchema>
