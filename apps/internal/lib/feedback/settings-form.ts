import { z } from 'zod'

import { FEEDBACK_LIMITS } from './constants'
import { parseFeedbackOriginsInput } from './origins'

/**
 * A project's feedback settings as its Feedback tab edits them: on or off,
 * and the websites allowed to send reports, typed one per line. The form
 * keeps the typed text; `feedbackSettingsOrigins` turns it into the list.
 */
export const feedbackSettingsSchema = z
  .object({
    enabled: z.boolean(),
    origins: z.string().max(4000),
  })
  .superRefine((value, context) => {
    const parsed = parseFeedbackOriginsInput(value.origins)
    if (!parsed.ok) {
      context.addIssue({
        code: 'custom',
        path: ['origins'],
        message: `Not a website: ${parsed.invalid.join(', ')}`,
      })
      return
    }
    if (parsed.origins.length > FEEDBACK_LIMITS.origins) {
      context.addIssue({
        code: 'custom',
        path: ['origins'],
        message: `List ${FEEDBACK_LIMITS.origins} websites at most.`,
      })
    }
  })

export type FeedbackSettingsValues = z.infer<typeof feedbackSettingsSchema>

/** The allowed websites from checked form text (empty when it doesn't parse). */
export function feedbackSettingsOrigins(text: string): string[] {
  const parsed = parseFeedbackOriginsInput(text)
  return parsed.ok ? parsed.origins : []
}
