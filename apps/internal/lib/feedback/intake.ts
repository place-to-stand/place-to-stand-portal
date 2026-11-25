import 'server-only'

import { randomUUID } from 'node:crypto'

import { clientIpFromHeaders, consumeRateLimit } from '@pts/db/rate-limit'

import { getCurrentStaff } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { detectContactSpam } from '@/lib/form-submissions/spam'
import {
  getFeedbackIntakeProject,
  insertFeedbackReport,
} from '@/lib/queries/feedback'
import {
  ensureTaskAttachmentBucket,
  deleteAttachmentObject,
} from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import {
  FEEDBACK_LIMITS,
  FEEDBACK_RATE_LIMITS,
  FEEDBACK_SCREENSHOT_PREFIX,
} from './constants'
import { allowedFeedbackOrigins, isFeedbackOriginAllowed } from './origins'
import {
  feedbackFieldsFromForm,
  feedbackPayloadSchema,
  SCREENSHOT_EXTENSIONS,
  sniffScreenshotType,
} from './payload'

export type IntakeResult =
  | { ok: true; id: string; allowOrigin: string | null }
  | {
      ok: false
      status: number
      error: string
      /** Set only when the caller is an allowed website, so it can read why. */
      allowOrigin: string | null
    }

/** The host of an Origin header or URL, or null. */
function originHost(value: string | null): string | null {
  if (!value || value === 'null') return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

const refuse = (
  status: number,
  error: string,
  allowOrigin: string | null = null
): IntakeResult => ({ ok: false, status, error, allowOrigin })

/**
 * Takes one report from the feedback widget. The endpoint is public, so the
 * checks run cheapest first and each one can only refuse:
 *
 *   1. size: the whole request under 3 MB, before it is read
 *   2. the form: known fields, sane lengths, a real project id
 *   3. the project: exists and has feedback turned on
 *   4. who's asking: a signed-in portal user on the portal itself, or a
 *      browser on one of the project's websites (the Origin header)
 *   5. rate limits, for visitors only: per IP and per project
 *   6. the screenshot: a PNG, JPEG or WebP by its bytes, 2 MB at most
 *
 * What passes is stored. The contact form's spam check then flags it (hidden
 * field, sent too fast, reads like a pitch); flagged reports are kept, with a
 * Spam badge, and never count as new.
 */
export async function takeFeedbackReport(
  request: Request,
  portalHost: string
): Promise<IntakeResult> {
  // Browsers always send a length with form data. A body without one could
  // be any size, and would be read whole before any other check.
  const declared = Number(request.headers.get('content-length'))
  if (!request.headers.has('content-length') || !Number.isFinite(declared)) {
    return refuse(411, 'Send the report with its length.')
  }
  if (declared > FEEDBACK_LIMITS.requestBytes) {
    return refuse(413, 'The report is too large.')
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return refuse(400, 'Send the report as form data.')
  }

  const parsed = feedbackPayloadSchema.safeParse(feedbackFieldsFromForm(form))
  if (!parsed.success) {
    return refuse(400, parsed.error.issues[0]?.message ?? 'Invalid report.')
  }
  const payload = parsed.data

  const project = await getFeedbackIntakeProject(payload.key)
  if (!project?.enabled) {
    return refuse(404, 'This project is not taking feedback.')
  }

  const origin = request.headers.get('origin')
  // Our own portal, with a portal session: the report carries who sent it.
  // Cookies only ride along on a same-site request, and the Origin check
  // keeps another site from borrowing them.
  // Hosts, not full origins: TLS ends before the app, so the scheme the
  // browser saw and the one this request carries can differ.
  const staff =
    originHost(origin) === portalHost ? await getCurrentStaff() : null

  let allowOrigin: string | null = null
  if (!staff) {
    const allowed = allowedFeedbackOrigins(project)
    if (!isFeedbackOriginAllowed(origin, allowed)) {
      return refuse(403, 'This website cannot send feedback for the project.')
    }
    allowOrigin = origin

    // The page must be on the website sending the report, so a report can't
    // carry a link to somewhere else dressed up as the page.
    if (payload.pageUrl && originHost(payload.pageUrl) !== originHost(origin)) {
      return refuse(
        400,
        'The page must be on the website sending the report.',
        allowOrigin
      )
    }

    // The caller's own limit first, and only a report it may send counts
    // toward the project's: one address can't use up a project's hour.
    const ip = clientIpFromHeaders(request.headers)
    const byIp = await consumeRateLimit(db, {
      key: `feedback-ip:${ip}`,
      limit: FEEDBACK_RATE_LIMITS.perIp,
      windowSeconds: FEEDBACK_RATE_LIMITS.windowSeconds,
    })
    const byProject = byIp.allowed
      ? await consumeRateLimit(db, {
          key: `feedback:${project.id}`,
          limit: FEEDBACK_RATE_LIMITS.perProject,
          windowSeconds: FEEDBACK_RATE_LIMITS.windowSeconds,
        })
      : null
    if (!byIp.allowed || !byProject?.allowed) {
      console.warn('Feedback report throttled', {
        projectId: project.id,
        ipHits: byIp.count,
        projectHits: byProject?.count ?? null,
      })
      return refuse(429, 'Too many reports. Try again later.', allowOrigin)
    }
  }

  const file = form.get('screenshot')
  let screenshot: {
    bytes: Uint8Array
    type: keyof typeof SCREENSHOT_EXTENSIONS
  } | null = null
  if (file instanceof File && file.size > 0) {
    if (file.size > FEEDBACK_LIMITS.screenshotBytes) {
      return refuse(413, 'The screenshot is too large.', allowOrigin)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffScreenshotType(bytes)
    if (!type) {
      return refuse(
        400,
        'The screenshot must be a PNG, JPEG or WebP image.',
        allowOrigin
      )
    }
    screenshot = { bytes, type }
  }

  const spamReason = staff
    ? null
    : detectContactSpam({
        message: payload.message,
        bot: {
          honeypot: payload.website !== null,
          elapsedMs: payload.elapsedMs ?? null,
        },
      })

  const id = randomUUID()
  const storage = getSupabaseServiceClient()
  let screenshotPath: string | null = null

  if (screenshot) {
    screenshotPath = `${FEEDBACK_SCREENSHOT_PREFIX}/${id}.${SCREENSHOT_EXTENSIONS[screenshot.type]}`
    await ensureTaskAttachmentBucket(storage)
    const { error } = await storage.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .upload(screenshotPath, screenshot.bytes, {
        contentType: screenshot.type,
        upsert: false,
      })
    if (error) {
      console.error('Feedback screenshot upload failed', error)
      return refuse(500, 'Could not save the screenshot.', allowOrigin)
    }
  }

  try {
    await insertFeedbackReport({
      id,
      projectId: project.id,
      type: payload.type,
      message: payload.message,
      pageUrl: payload.pageUrl,
      pageTitle: payload.pageTitle,
      screenshotPath,
      screenshotMimeType: screenshot?.type ?? null,
      screenshotSize: screenshot?.bytes.byteLength ?? null,
      reporterUserId: staff?.id ?? null,
      reporterName: staff ? null : payload.name,
      reporterEmail: staff ? null : payload.email,
      origin,
      userAgent:
        request.headers
          .get('user-agent')
          ?.slice(0, FEEDBACK_LIMITS.userAgent) ?? null,
      viewport: payload.viewport,
      language: payload.language,
      timezone: payload.timezone,
      posthogSessionId: payload.posthogSessionId,
      posthogReplayUrl: payload.posthogReplayUrl,
      spamReason,
    })
  } catch (error) {
    console.error('Feedback report insert failed', error)
    if (screenshotPath) {
      await deleteAttachmentObject({
        client: storage,
        path: screenshotPath,
      }).catch(() => {})
    }
    return refuse(500, 'Could not save the report.', allowOrigin)
  }

  if (spamReason) {
    console.warn('Feedback report flagged as spam', { id, spamReason })
  }

  return { ok: true, id, allowOrigin }
}
