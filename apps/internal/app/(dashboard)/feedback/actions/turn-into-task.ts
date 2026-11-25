'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { feedbackTurnedIntoTaskEvent } from '@/lib/activity/events'
import { logFeedbackActivity } from '@/lib/activity/feedback-log'

import { requirePage } from '@/lib/auth/session'
import { feedbackTaskDraft } from '@/lib/feedback/task-draft'
import {
  getFeedbackReportById,
  updateFeedbackReport,
} from '@/lib/queries/feedback'
import { projectTaskHref } from '@/lib/sheets/hrefs'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import {
  deleteAttachmentObject,
  ensureTaskAttachmentBucket,
  generatePendingAttachmentPath,
  resolveAttachmentExtension,
} from '@/lib/storage/task-attachments'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { archiveTask } from '@/lib/tasks/archive-task'
import { revalidateTaskViews } from '@/lib/tasks/revalidate-task-views'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'

import type { TurnIntoTaskResult } from './types'

const idSchema = z.object({ id: z.uuid() })

/**
 * Makes a task on the report's project from the report: its message, page,
 * reporter and replay link in the description, and a copy of its screenshot
 * as an attachment (the report keeps its own). The task starts On deck with
 * nobody assigned. The report is then marked seen and points at the task.
 */
export async function turnFeedbackIntoTask(input: {
  id: string
}): Promise<TurnIntoTaskResult> {
  const user = await requirePage('feedback.manage')
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid request.' }

  const report = await getFeedbackReportById(parsed.data.id)
  if (!report || report.deletedAt) return { error: 'Report not found.' }
  if (report.taskId) return { error: 'This report is already a task.' }

  const storage = getSupabaseServiceClient()
  let pendingScreenshot: {
    path: string
    originalName: string
    mimeType: string
    fileSize: number
  } | null = null

  if (report.screenshotPath && report.screenshotMimeType) {
    const extension = resolveAttachmentExtension(report.screenshotMimeType)
    if (extension) {
      const path = generatePendingAttachmentPath({
        actorId: user.id,
        extension,
      })
      await ensureTaskAttachmentBucket(storage)
      const { error } = await storage.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .copy(report.screenshotPath, path)
      if (error) {
        console.error('Failed to copy feedback screenshot', error)
        return { error: 'Unable to copy the screenshot to the task.' }
      }
      pendingScreenshot = {
        path,
        originalName: `screenshot.${extension}`,
        mimeType: report.screenshotMimeType,
        fileSize: Math.max(1, report.screenshotSize ?? 1),
      }
    }
  }

  const draft = feedbackTaskDraft(report)
  const result = await saveTaskForActor(
    user,
    {
      projectId: report.projectId,
      title: draft.title,
      description: draft.description,
      status: 'ON_DECK',
      assigneeIds: [],
      attachments: {
        toAttach: pendingScreenshot ? [pendingScreenshot] : [],
        toRemove: [],
      },
    },
    'ADMIN_UI'
  )

  if (!result.taskId) {
    if (pendingScreenshot) {
      await deleteAttachmentObject({
        client: storage,
        path: pendingScreenshot.path,
      }).catch(() => {})
    }
    return { error: result.error ?? 'Unable to create the task.' }
  }

  // Claim the report for this task. If someone else turned it into a task a
  // moment ago, this one is a duplicate: archive it and point at theirs.
  const claimed = await updateFeedbackReport(
    report.id,
    {
      taskId: result.taskId,
      acknowledgedAt: report.acknowledgedAt ?? new Date().toISOString(),
      acknowledgedBy: user.id,
    },
    { archived: false, withoutTask: true }
  )
  if (!claimed) {
    await archiveTask(user, result.taskId).catch(error =>
      console.error('Failed to archive duplicate feedback task', error)
    )
    return { error: 'This report has changed. Reload and try again.' }
  }

  await logFeedbackActivity(user, report, args =>
    feedbackTurnedIntoTaskEvent({
      ...args,
      taskId: result.taskId,
      taskTitle: draft.title,
    })
  )

  revalidateTaskViews()
  revalidatePath('/', 'layout')

  return {
    taskId: result.taskId,
    href: projectTaskHref(
      {
        projectSlug: report.projectSlug,
        projectType: report.projectType,
        clientSlug: report.clientSlug,
      },
      result.taskId
    ),
  }
}
