import { escapeHtml } from '@/lib/cli/markdown'

import { FEEDBACK_TYPE_LABELS, type FeedbackType } from './constants'

const TITLE_MAX = 80

/**
 * The task a report becomes: "Bug: <first line>" and a description holding
 * the whole message and where it came from. The description is the task
 * editor's HTML, so everything the reporter wrote is escaped.
 */
export function feedbackTaskDraft(report: {
  type: FeedbackType
  message: string
  pageUrl: string | null
  pageTitle: string | null
  reporterName: string | null
  reporterEmail: string | null
  posthogReplayUrl: string | null
}): { title: string; description: string } {
  const firstLine =
    report.message
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? ''
  const short =
    firstLine.length > TITLE_MAX
      ? `${firstLine.slice(0, TITLE_MAX - 1).trimEnd()}…`
      : firstLine
  const title = `${FEEDBACK_TYPE_LABELS[report.type]}: ${short}`

  const paragraphs = report.message
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(
      block =>
        `<p>${block
          .split('\n')
          .map(line => escapeHtml(line))
          .join('<br>')}</p>`
    )

  const details: string[] = []
  if (report.pageUrl) {
    details.push(
      `Page: <a href="${escapeHtml(report.pageUrl)}">${escapeHtml(
        report.pageTitle || report.pageUrl
      )}</a>`
    )
  }
  const reporter = [report.reporterName, report.reporterEmail]
    .filter(Boolean)
    .join(', ')
  if (reporter) details.push(`From: ${escapeHtml(reporter)}`)
  if (report.posthogReplayUrl) {
    details.push(
      `<a href="${escapeHtml(report.posthogReplayUrl)}">Session replay</a>`
    )
  }

  const description = [
    ...paragraphs,
    ...(details.length > 0 ? [`<p>${details.join('<br>')}</p>`] : []),
  ].join('')

  return { title, description }
}
