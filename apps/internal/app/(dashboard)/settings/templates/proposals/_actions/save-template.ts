'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  createProposalTemplate,
  updateProposalTemplate,
  type ProposalTemplateType,
} from '@/lib/queries/proposal-templates'

const termsSectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
})

const saveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: z.enum(['TERMS_AND_CONDITIONS'] as const),
  content: z.array(termsSectionSchema).min(1, 'At least one section is required'),
  isDefault: z.boolean().optional(),
})

export type SaveProposalTemplateInput = z.infer<typeof saveTemplateSchema>

export type SaveProposalTemplateResult = {
  success: boolean
  error?: string
  templateId?: string
}

export async function saveProposalTemplate(
  input: SaveProposalTemplateInput
): Promise<SaveProposalTemplateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = saveTemplateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid template data.',
    }
  }

  try {
    if (parsed.data.id) {
      const updated = await updateProposalTemplate(parsed.data.id, {
        name: parsed.data.name,
        type: parsed.data.type as ProposalTemplateType,
        content: parsed.data.content,
        isDefault: parsed.data.isDefault,
      })

      if (!updated) {
        return { success: false, error: 'Template not found.' }
      }

      revalidatePath('/settings/templates/proposals')
      return { success: true, templateId: updated.id }
    } else {
      const created = await createProposalTemplate({
        name: parsed.data.name,
        type: parsed.data.type as ProposalTemplateType,
        content: parsed.data.content,
        isDefault: parsed.data.isDefault,
      })

      revalidatePath('/settings/templates/proposals')
      return { success: true, templateId: created?.id }
    }
  } catch (error) {
    console.error('Failed to save proposal template:', error)
    return { success: false, error: 'Unable to save template. Please try again.' }
  }
}
