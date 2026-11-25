'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import {
  feedbackSettingsOrigins,
  feedbackSettingsSchema,
} from '@/lib/feedback/settings-form'
import { updateProjectFeedbackSettings } from '@/lib/queries/feedback'

const inputSchema = z.object({
  projectId: z.uuid(),
  settings: feedbackSettingsSchema,
})

export type SaveFeedbackSettingsResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: { origins?: string } }

/** Saves a project's Feedback tab: on or off, and its allowed websites. */
export async function saveProjectFeedbackSettings(input: {
  projectId: string
  settings: { enabled: boolean; origins: string }
}): Promise<SaveFeedbackSettingsResult> {
  await requirePage('feedback.manage')
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const originsIssue = parsed.error.issues.find(
      issue => issue.path.at(-1) === 'origins'
    )
    return {
      ok: false,
      error: originsIssue?.message ?? 'Invalid settings.',
      fieldErrors: originsIssue ? { origins: originsIssue.message } : undefined,
    }
  }

  try {
    const saved = await updateProjectFeedbackSettings(parsed.data.projectId, {
      enabled: parsed.data.settings.enabled,
      origins: feedbackSettingsOrigins(parsed.data.settings.origins),
    })
    if (!saved) return { ok: false, error: 'Project not found.' }
  } catch (error) {
    console.error('Failed to save feedback settings', error)
    return { ok: false, error: 'Unable to save the feedback settings.' }
  }

  revalidatePath('/projects', 'layout')
  return { ok: true }
}
