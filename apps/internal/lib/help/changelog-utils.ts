/** One line of What's new: the area it touches (bold lead) and the change. */
export type ChangelogItem = {
  area: string | null
  text: string
}

/** One week of What's new, newest first in the list. */
export type ChangelogWeek = {
  /** The heading as written, e.g. "Week of November 16, 2026". */
  title: string
  /** Stable id for "seen" tracking: the heading, lowercased and dashed. */
  id: string
  items: ChangelogItem[]
}

const WEEK_HEADING = /^##\s+(.+?)\s*$/
const ITEM_LINE = /^[-*]\s+(.+?)\s*$/
// The area needs its colon (`**Boards:**` or `**Boards**:`), so a line that
// merely starts in bold stays whole.
const AREA_LEAD = /^\*\*(.+?)(?::\*\*|\*\*:)\s*(.+)$/

/**
 * Reads CHANGELOG.md: each `## ` heading starts a week, each `- ` line under
 * it is one change. Everything else (the title, the note for writers) is
 * skipped, and a week with no lines is left out.
 */
export function parseChangelog(markdown: string): ChangelogWeek[] {
  const weeks: ChangelogWeek[] = []
  let current: ChangelogWeek | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const heading = WEEK_HEADING.exec(line)
    if (heading) {
      current = { title: heading[1], id: weekId(heading[1]), items: [] }
      weeks.push(current)
      continue
    }
    const item = current ? ITEM_LINE.exec(line) : null
    if (current && item) current.items.push(parseItem(item[1]))
  }

  return weeks.filter(week => week.items.length > 0)
}

function parseItem(raw: string): ChangelogItem {
  const lead = AREA_LEAD.exec(raw)
  if (lead) return { area: lead[1], text: lead[2] }
  return { area: null, text: raw }
}

function weekId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * What "seen" remembers for the newest week: its id plus a hash of its lines,
 * so a line added to a week someone already opened brings the dot back.
 */
export function changelogVersion(week: ChangelogWeek) {
  let hash = 5381
  for (const item of week.items) {
    const line = `${item.area ?? ''}\u0000${item.text}\n`
    for (let index = 0; index < line.length; index++) {
      hash = ((hash << 5) + hash + line.charCodeAt(index)) >>> 0
    }
  }
  return `${week.id}:${hash.toString(36)}`
}
