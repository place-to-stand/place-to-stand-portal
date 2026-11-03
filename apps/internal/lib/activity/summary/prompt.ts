/** The prompts and fallback text for the activity summary. */
import type { ActivityLogWithActor } from '@/lib/activity/types'
import {
  ValidTimeframe,
  TIMEFRAME_BULLET_RANGE,
  ActivityMetrics,
} from './config'
import { isViewEvent } from './metrics'
import { ActivityContext, formatActivityLog } from './context'

export function buildSystemPrompt(timeframe: ValidTimeframe): string {
  return [
    "You're a chief of staff writing a brief team activity briefing.",
    `Based on the last ${timeframe} day${timeframe === 1 ? '' : 's'} of activity, write a summary broken down by team member.`,
    '',
    'Format rules:',
    '- The entire output is bold headings with bullet points under them. Nothing else.',
    '- Use **Name** as a bold heading for each team member who had activity.',
    `- Under each name, use ${TIMEFRAME_BULLET_RANGE[timeframe]} bullet points (using -) summarizing their key contributions. Cover the whole window, not just the most recent days.`,
    '- Each bullet should be a concise, specific sentence mentioning project names or clients when available.',
    '- Focus on what matters: progress made, deals or leads, blockers, or notable momentum.',
    '- Write conversationally and casually.',
    '- If a team member only had minor activity (e.g., a single comment), you can combine them into an "Others" section.',
    '- Any closing section (e.g. **Heads up** or **Good news**) follows the same shape: a bold heading on its own line, then bullets. Never write a paragraph or a bold label followed by prose on the same line.',
    '- No H1/H2 headers (#), no code blocks, no free-standing sentences — just bold headings and bullets.',
    '',
    'Example:',
    '**Jason**',
    '- Knocked out 5 tasks on the Acme dashboard redesign, moving it closer to launch.',
    '- Logged 3.5 hours on the WidgetCo API integration.',
    '',
    '**Sarah**',
    '- Closed 2 new leads from the website — worth following up on.',
    '- Flagged a blocker on the API integration waiting on client feedback.',
    '',
    '**Heads up**',
    '- 2 tasks are blocked on client feedback — nudge Acme this week so the launch date holds.',
  ].join('\n')
}

export function buildUserPrompt({
  timeframeDays,
  logs,
  now,
  context,
  metrics,
}: {
  timeframeDays: ValidTimeframe
  logs: ActivityLogWithActor[]
  now: Date
  context: ActivityContext
  metrics: ActivityMetrics
}): string {
  const timeframeLabel = timeframeDaysLabel(timeframeDays)

  // Group logs by actor for per-member breakdown. Every non-view row the
  // query returned goes in; the per-timeframe fetch limit bounds the size.
  const logsByActor = new Map<string, string[]>()
  for (const log of logs.filter(log => !isViewEvent(log))) {
    const actorName = (
      log.actor?.full_name?.trim() ||
      log.actor?.email ||
      'System'
    ).replace(/\s+/g, ' ')
    const existing = logsByActor.get(actorName) ?? []
    existing.push(formatActivityLog(log, context))
    logsByActor.set(actorName, existing)
  }

  const groupedSection = Array.from(logsByActor.entries())
    .map(([actor, entries]) => `=== ${actor} ===\n${entries.join('\n')}`)
    .join('\n\n')

  return [
    `Today is ${now.toISOString()}. Write a team activity summary for ${timeframeLabel}.`,
    '',
    'Current metrics:',
    `- New leads: ${metrics.newLeads}`,
    `- Active projects: ${metrics.activeProjects}`,
    `- Blocked tasks: ${metrics.blockedTasks}`,
    '',
    'Activity grouped by team member, oldest first. Each line is:',
    '[timestamp] verb · target · "summary" (project / client) {metadata}',
    '',
    groupedSection,
    '',
    'Write a summary broken down by team member using **Name** headings and bullet points. Keep it concise and actionable. Every line must be either a bold heading or a bullet — no paragraphs.',
  ].join('\n')
}

export function buildNoActivityHighlight(
  timeframeDays: ValidTimeframe
): string {
  const label = timeframeDaysLabel(timeframeDays)
  return `No activity logged during the ${label}. Things are quiet on the operations front—a good time to plan ahead or check in with the team.`
}

export function buildFallbackHighlight(
  logs: ActivityLogWithActor[],
  timeframeDays: number,
  metrics: ActivityMetrics
): string {
  const dayLabel = timeframeDays === 1 ? 'day' : 'days'
  const bullets: string[] = []

  if (metrics.newLeads > 0) {
    const leadWord = metrics.newLeads === 1 ? 'lead' : 'leads'
    bullets.push(`${metrics.newLeads} new ${leadWord} came in — worth a look.`)
  }

  if (metrics.blockedTasks > 0) {
    const blockedWord = metrics.blockedTasks === 1 ? 'task is' : 'tasks are'
    bullets.push(
      `${metrics.blockedTasks} ${blockedWord} currently blocked and may need attention.`
    )
  }

  if (bullets.length === 0) {
    return `${logs.length} updates logged over the past ${timeframeDays} ${dayLabel}. Activity is ticking along steadily.`
  }

  return '**Team Summary**\n' + bullets.map(b => `- ${b}`).join('\n')
}

export function enforceHighlightCharacterLimit(
  text: string,
  limit: number
): string {
  const trimmed = text.trim()
  if (trimmed.length <= limit) {
    return trimmed
  }
  return trimmed.slice(0, limit - 1).trimEnd() + '…'
}

export function timeframeDaysLabel(timeframe: ValidTimeframe): string {
  switch (timeframe) {
    case 1:
      return 'last 1 day'
    case 7:
      return 'last 7 days'
    case 14:
      return 'last 14 days'
    case 28:
      return 'last 28 days'
    default:
      return `${timeframe} days`
  }
}
