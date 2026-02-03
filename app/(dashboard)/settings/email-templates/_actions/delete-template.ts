'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { deleteEmailTemplate } from '@/lib/queries/email-templates'

const deleteTemplateSchema = z.object({
  templateId: z.string().uuid(),
})

export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>

export type DeleteTemplateResult = {
  success: boolean
  error?: string
}

export async function deleteTemplate(
  input: DeleteTemplateInput
): Promise<DeleteTemplateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = deleteTemplateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const deleted = await deleteEmailTemplate(parsed.data.templateId)

    if (!deleted) {
      return { success: false, error: 'Template not found.' }
    }

    revalidatePath('/settings/email-templates')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete template:', error)
    return { success: false, error: 'Unable to delete template. Please try again.' }
  }
}
