'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  createEmailTemplate,
  updateEmailTemplate,
} from '@/lib/queries/email-templates'
import { EMAIL_TEMPLATE_CATEGORIES } from '@/lib/email/templates'

const saveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  category: z.enum(EMAIL_TEMPLATE_CATEGORIES),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  bodyHtml: z.string().min(1, 'Body is required'),
  bodyText: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
})

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>

export type SaveTemplateResult = {
  success: boolean
  error?: string
  templateId?: string
}

export async function saveTemplate(
  input: SaveTemplateInput
): Promise<SaveTemplateResult> {
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
      const updated = await updateEmailTemplate(parsed.data.id, {
        name: parsed.data.name,
        category: parsed.data.category,
        subject: parsed.data.subject,
        bodyHtml: parsed.data.bodyHtml,
        bodyText: parsed.data.bodyText ?? null,
        isDefault: parsed.data.isDefault,
      })

      if (!updated) {
        return { success: false, error: 'Template not found.' }
      }

      revalidatePath('/settings/templates')
      return { success: true, templateId: updated.id }
    } else {
      const created = await createEmailTemplate({
        name: parsed.data.name,
        category: parsed.data.category,
        subject: parsed.data.subject,
        bodyHtml: parsed.data.bodyHtml,
        bodyText: parsed.data.bodyText ?? null,
        isDefault: parsed.data.isDefault,
        createdBy: user.id,
      })

      revalidatePath('/settings/templates')
      return { success: true, templateId: created?.id }
    }
  } catch (error) {
    console.error('Failed to save template:', error)
    return { success: false, error: 'Unable to save template. Please try again.' }
  }
}
