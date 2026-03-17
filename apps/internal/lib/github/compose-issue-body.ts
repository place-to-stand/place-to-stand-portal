/**
 * Compose the GitHub issue body from a portal task.
 */

const MAX_DESCRIPTION_LENGTH = 4000

export function composeIssueBody(params: {
  taskTitle: string
  taskDescription: string | null
  portalUrl: string
}): string {
  const { taskDescription, portalUrl } = params

  const lines: string[] = []

  if (taskDescription) {
    const plainText = stripHtml(taskDescription)
    const truncated =
      plainText.length > MAX_DESCRIPTION_LENGTH
        ? `${plainText.slice(0, MAX_DESCRIPTION_LENGTH)}…`
        : plainText
    lines.push(truncated)
    lines.push('')
  }

  lines.push(`---`)
  lines.push(`*Created from [portal task](${portalUrl})*`)

  return lines.join('\n')
}

/** Naive HTML-to-plain-text: strip tags, decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
