import { z } from 'zod'

import { UUID_PATTERN } from '@pts/db/uuid'

import { FEEDBACK_LIMITS, FEEDBACK_TYPES } from './constants'

/**
 * The widget's report, sent as multipart form data so the screenshot can ride
 * along as a file. Everything but the key, the type and the message is
 * optional: an older widget, or one on a page without PostHog, still lands.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(value => (value === '' ? null : value))
    .nullable()
    .optional()
    .transform(value => value ?? null)

const httpUrl = (max: number) =>
  optionalText(max).refine(
    value => value === null || isHttpUrl(value),
    'Not a web address.'
  )

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * A replay link is shown to staff as a link, so it must point at PostHog and
 * nowhere else: a stranger can't plant a lookalike address in the triage list.
 */
export function isPostHogReplayUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'posthog.com' || url.hostname.endsWith('.posthog.com'))
    )
  } catch {
    return false
  }
}

export const feedbackPayloadSchema = z.object({
  /** The project id: the widget's key. */
  key: z.string().regex(UUID_PATTERN, 'Unknown project.'),
  type: z.enum(FEEDBACK_TYPES, { message: 'Pick bug, request or question.' }),
  message: z
    .string()
    .trim()
    .min(1, 'Write a message.')
    .max(FEEDBACK_LIMITS.message, 'The message is too long.'),
  pageUrl: httpUrl(FEEDBACK_LIMITS.url),
  pageTitle: optionalText(FEEDBACK_LIMITS.title),
  name: optionalText(FEEDBACK_LIMITS.name),
  email: optionalText(FEEDBACK_LIMITS.email).refine(
    value => value === null || z.email().safeParse(value).success,
    'Not an email address.'
  ),
  viewport: optionalText(FEEDBACK_LIMITS.short),
  language: optionalText(FEEDBACK_LIMITS.short),
  timezone: optionalText(FEEDBACK_LIMITS.short),
  posthogSessionId: optionalText(FEEDBACK_LIMITS.short),
  posthogReplayUrl: optionalText(FEEDBACK_LIMITS.url).refine(
    value => value === null || isPostHogReplayUrl(value),
    'Not a PostHog replay link.'
  ),
  /** The hidden trap field: any text in it means a form filler. */
  website: optionalText(FEEDBACK_LIMITS.url),
  /** Milliseconds from opening the form to pressing Send. */
  elapsedMs: z.coerce.number().int().nonnegative().nullable().optional(),
})

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>

const TEXT_FIELDS = [
  'key',
  'type',
  'message',
  'pageUrl',
  'pageTitle',
  'name',
  'email',
  'viewport',
  'language',
  'timezone',
  'posthogSessionId',
  'posthogReplayUrl',
  'website',
  'elapsedMs',
] as const

/** Reads the text fields out of the form; files in a text field are dropped. */
export function feedbackFieldsFromForm(
  form: FormData
): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {}
  for (const name of TEXT_FIELDS) {
    const value = form.get(name)
    if (typeof value === 'string' && value !== '') fields[name] = value
  }
  return fields
}

export type ScreenshotType = 'image/png' | 'image/jpeg' | 'image/webp'

export const SCREENSHOT_EXTENSIONS: Record<ScreenshotType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * The image type from the file's first bytes, never from its name or the
 * type the browser claimed, so nothing but a PNG, JPEG or WebP is stored.
 */
export function sniffScreenshotType(bytes: Uint8Array): ScreenshotType | null {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png'
  }
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}
