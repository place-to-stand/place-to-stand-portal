/**
 * AI prompt for unified email classification — matches both clients and projects in one call
 */

export const EMAIL_CLASSIFY_SYSTEM_PROMPT = `You are an AI assistant for a professional services agency. Your task is to analyze emails and determine which client(s) AND project(s) they are most likely related to.

You will be given:
1. Email metadata (from, to, cc, subject)
2. Email content/snippet
3. A list of clients with their known contacts and project names
4. A list of projects with their client associations

## Client Matching

Analyze the email and determine the best client match based on:
- Email addresses (exact matches with known contacts)
- Email domains (matching company domains)
- Email content mentioning client names, project names, or related keywords
- Contextual clues in the email body

## Project Matching

Analyze the email and determine the best project match based on:
- Project name mentions in subject or body
- Client context (if a client match is found, prioritize their projects)
- Keywords and topics matching project scope
- Contextual clues in the email body

## Confidence Scores (0.0 to 1.0)

For clients:
- 1.0: Definite match (exact email match with known contact)
- 0.8-0.9: Very likely match (domain match or strong content signals)
- 0.6-0.7: Probable match (content mentions client/project)
- 0.4-0.5: Possible match (weak contextual signals)
- Below 0.4: Don't include as a suggestion

For projects:
- 1.0: Definite match (explicit project name mention)
- 0.8-0.9: Very likely match (strong content signals or context)
- 0.6-0.7: Probable match (related topics or client context)
- 0.4-0.5: Possible match (weak contextual signals)
- Below 0.4: Don't include as a suggestion

IMPORTANT: When returning matches, you MUST use the exact IDs (UUIDs) provided in the lists. Do NOT use names as IDs.

Only return matches you're reasonably confident about. It's better to return no suggestions than wrong ones.`

export interface EmailClassifyPromptParams {
  email: {
    from: string | null
    to: string[]
    cc: string[]
    subject: string | null
    snippet: string | null
    bodyPreview?: string | null
  }
  clients: Array<{
    id: string
    name: string
    contacts: Array<{ email: string; name: string | null }>
    projects: Array<{ name: string }>
  }>
  projects: Array<{
    id: string
    name: string
    clientName: string | null
  }>
}

export function buildEmailClassifyUserPrompt(params: EmailClassifyPromptParams): string {
  const { email, clients, projects } = params

  const emailSection = `## Email Details
- **From:** ${email.from || 'Unknown'}
- **To:** ${email.to.join(', ') || 'Unknown'}
- **CC:** ${email.cc.join(', ') || 'None'}
- **Subject:** ${email.subject || '(no subject)'}

### Email Content
${email.snippet || email.bodyPreview || '(no content available)'}`

  const clientsSection = `## Available Clients

${clients.map(client => `### ${client.name}
- **Client ID (use this exact UUID):** ${client.id}
- **Known Contacts:** ${client.contacts.length > 0 ? client.contacts.map(c => `${c.email}${c.name ? ` (${c.name})` : ''}`).join(', ') : 'None'}
- **Projects:** ${client.projects.length > 0 ? client.projects.map(p => p.name).join(', ') : 'None'}`).join('\n\n')}`

  const projectsSection = `## Available Projects

${projects.map(project => `### ${project.name}
- **Project ID (use this exact UUID):** ${project.id}
- **Client:** ${project.clientName || 'Internal/Personal Project'}`).join('\n\n')}`

  return `${emailSection}

${clientsSection}

${projectsSection}

Analyze this email and identify which client(s) and project(s) it is most likely related to. For each match, use the EXACT ID (UUID) shown above. Provide your reasoning and confidence score for each match.`
}
