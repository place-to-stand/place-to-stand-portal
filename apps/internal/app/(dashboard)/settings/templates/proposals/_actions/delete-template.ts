'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { deleteProposalTemplate } from '@/lib/queries/proposal-templates'

const deleteTemplateSchema = z.object({
  templateId: z.string().uuid(),
})

export type DeleteProposalTemplateInput = z.infer<typeof deleteTemplateSchema>

export type DeleteProposalTemplateResult = {
  success: boolean
  error?: string
}

export async function deleteProposalTemplateAction(
  input: DeleteProposalTemplateInput
): Promise<DeleteProposalTemplateResult> {
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
    const deleted = await deleteProposalTemplate(parsed.data.templateId)

    if (!deleted) {
      return { success: false, error: 'Template not found.' }
    }

    revalidatePath('/settings/templates/proposals')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete proposal template:', error)
    return { success: false, error: 'Unable to delete template. Please try again.' }
  }
}
