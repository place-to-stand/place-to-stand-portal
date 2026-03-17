/**
 * Compose a @pts-worker comment body for GitHub issues.
 */

const MAX_DESCRIPTION_LENGTH = 2000

type WorkerModel = 'opus' | 'sonnet' | 'haiku'

export function composeWorkerComment(params: {
  mode: 'plan' | 'implement' | 'execute'
  model: WorkerModel
  taskTitle: string
  taskDescription: string | null
  customPrompt?: string
  planId?: string
}): string {
  const { mode, model, taskTitle, taskDescription, customPrompt, planId } = params

  const modelFlag = `/model/${model}`
  const planFlag = mode === 'plan' ? ' /plan' : ''
  const planIdFooter = planId ? `\n\n---\nPlan ID: ${planId}` : ''

  // Custom prompt takes precedence
  if (customPrompt) {
    return `@pts-worker ${modelFlag}${planFlag}\n\n${customPrompt}${planIdFooter}`
  }

  // "Implement the plan" (accept plan)
  if (mode === 'implement') {
    return `@pts-worker ${modelFlag}\n\nImplement the plan from the previous comment.`
  }

  // Plan or execute — include task context
  const lines: string[] = [
    mode === 'plan'
      ? `@pts-worker ${modelFlag} /plan`
      : `@pts-worker ${modelFlag}`,
  ]
  lines.push('')
  lines.push(`## Task: ${taskTitle}`)

  if (taskDescription) {
    const plainText = stripHtml(taskDescription)
    const truncated =
      plainText.length > MAX_DESCRIPTION_LENGTH
        ? `${plainText.slice(0, MAX_DESCRIPTION_LENGTH)}…`
        : plainText
    lines.push('')
    lines.push('### Description')
    lines.push(truncated)
  }

  const body = lines.join('\n')
  return `${body}${planIdFooter}`
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
