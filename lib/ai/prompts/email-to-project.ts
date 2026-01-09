/**
 * AI prompts for matching emails to projects
 */

export const EMAIL_TO_PROJECT_SYSTEM_PROMPT = `You are an AI assistant for a professional services agency. Your task is to analyze emails and determine which project(s) they are most likely related to.

You will be given:
1. Email metadata (from, to, cc, subject)
2. Email content/snippet
3. A list of projects with their client associations

Analyze the email and determine the best project match based on:
- Project name mentions in subject or body
- Client context (if the email is already associated with a client, prioritize their projects)
- Keywords and topics matching project scope
- Contextual clues in the email body

Return your analysis with confidence scores (0.0 to 1.0):
- 1.0: Definite match (explicit project name mention)
- 0.8-0.9: Very likely match (strong content signals or context)
- 0.6-0.7: Probable match (related topics or client context)
- 0.4-0.5: Possible match (weak contextual signals)
- Below 0.4: Don't include as a suggestion

IMPORTANT: When returning matches, you MUST use the exact project ID (UUID) provided in the project list. Do NOT use the project name as the ID.

Only return projects you're reasonably confident about. It's better to return no suggestions than wrong ones.`

export interface EmailToProjectPromptParams {
  email: {
    from: string | null
    to: string[]
    cc: string[]
    subject: string | null
    snippet: string | null
    bodyPreview?: string | null
  }
  projects: Array<{
    id: string
    name: string
    clientName: string | null
  }>
  linkedClientId?: string | null
}

export function buildEmailToProjectUserPrompt(params: EmailToProjectPromptParams): string {
  const { email, projects, linkedClientId } = params

  const emailSection = `## Email Details
- **From:** ${email.from || 'Unknown'}
- **To:** ${email.to.join(', ') || 'Unknown'}
- **CC:** ${email.cc.join(', ') || 'None'}
- **Subject:** ${email.subject || '(no subject)'}

### Email Content
${email.snippet || email.bodyPreview || '(no content available)'}`

  const contextSection = linkedClientId
    ? `\n\n## Context
This email is already linked to a client. Projects belonging to that client should be prioritized.\n`
    : ''

  const projectsSection = `## Available Projects

${projects.map(project => `### ${project.name}
- **Project ID (use this exact UUID):** ${project.id}
- **Client:** ${project.clientName || 'Internal/Personal Project'}`).join('\n\n')}`

  return `${emailSection}${contextSection}

${projectsSection}

Analyze this email and identify which project(s) it is most likely related to. For each match, use the EXACT Project ID (UUID) shown above - do NOT use the project name as the ID. Provide your reasoning and confidence score for each match.`
}
