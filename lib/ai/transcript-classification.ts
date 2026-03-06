import 'server-only'

import { generateText, Output } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import { z } from 'zod'

const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

// =============================================================================
// Types
// =============================================================================

export type TranscriptClassificationResult = {
  clientMatches: Array<{
    clientId: string
    clientName: string
    projectId?: string
    projectName?: string
    confidence: number
    reasoning: string
  }>
  leadMatches: Array<{
    leadId: string
    leadName: string
    companyName?: string
    confidence: number
    reasoning: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

export interface ClassifyTranscriptParams {
  title: string
  participantNames: string[]
  contentSnippet: string
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; clientId: string; clientName: string }>
  leads: Array<{ id: string; contactName: string; companyName: string | null }>
}

// =============================================================================
// Schema
// =============================================================================

const transcriptClassifyResponseSchema = z.object({
  clientMatches: z
    .array(
      z.object({
        clientId: z.string().uuid().describe('The exact UUID of the matched client'),
        clientName: z.string().describe('The name of the matched client'),
        projectId: z.string().uuid().optional().describe('The exact UUID of the matched project (if applicable)'),
        projectName: z.string().optional().describe('The name of the matched project'),
        confidence: z.number().min(0).max(1).describe('Confidence score 0.0-1.0'),
        reasoning: z.string().max(500).describe('Brief explanation'),
      })
    )
    .max(5)
    .describe('Matched clients, sorted by confidence'),
  leadMatches: z
    .array(
      z.object({
        leadId: z.string().uuid().describe('The exact UUID of the matched lead'),
        leadName: z.string().describe('The contact name of the matched lead'),
        companyName: z.string().optional().describe('The company name of the matched lead'),
        confidence: z.number().min(0).max(1).describe('Confidence score 0.0-1.0'),
        reasoning: z.string().max(500).describe('Brief explanation'),
      })
    )
    .max(5)
    .describe('Matched leads, sorted by confidence'),
  noMatchReason: z
    .string()
    .max(500)
    .optional()
    .describe('If no matches found, briefly explain why'),
})

// =============================================================================
// System Prompt
// =============================================================================

const TRANSCRIPT_CLASSIFY_SYSTEM_PROMPT = `You are a meeting transcript classifier for a digital agency. Given a meeting transcript title, participant names, and content snippet, determine which client, project, or lead this meeting relates to.

Consider:
- Participant names that match client contacts or lead names
- Project names, client names, or company names mentioned in the transcript
- The nature of the discussion (project updates, discovery calls, internal planning)
- Internal meetings (no external participants) may relate to internal projects

## Confidence Scores (0.0 to 1.0)

For clients:
- 0.8-1.0: Strong match (client/project name explicitly mentioned, or known participants)
- 0.6-0.7: Probable match (related topics, indirect references)
- 0.4-0.5: Possible match (weak signals)
- Below 0.4: Don't include

For leads:
- 0.8-1.0: Strong match (lead name/company mentioned, or discovery call context)
- 0.6-0.7: Probable match (related topics)
- 0.4-0.5: Possible match (weak signals)
- Below 0.4: Don't include

IMPORTANT: Use the exact IDs (UUIDs) provided in the lists. Do NOT use names as IDs.

Only return matches you're reasonably confident about. It's better to return no suggestions than wrong ones.`

// =============================================================================
// Classification
// =============================================================================

export async function classifyTranscript(
  params: ClassifyTranscriptParams
): Promise<TranscriptClassificationResult> {
  if (
    params.clients.length === 0 &&
    params.projects.length === 0 &&
    params.leads.length === 0
  ) {
    return {
      clientMatches: [],
      leadMatches: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  const userPrompt = buildUserPrompt(params)

  const { output, usage } = await generateText({
    model,
    system: TRANSCRIPT_CLASSIFY_SYSTEM_PROMPT,
    prompt: userPrompt,
    output: Output.object({ schema: transcriptClassifyResponseSchema }),
  })

  const filteredClientMatches = output!.clientMatches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  const filteredLeadMatches = output!.leadMatches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    clientMatches: filteredClientMatches,
    leadMatches: filteredLeadMatches,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}

function buildUserPrompt(params: ClassifyTranscriptParams): string {
  const transcriptSection = `## Transcript Details
- **Title:** ${params.title}
- **Participants:** ${params.participantNames.length > 0 ? params.participantNames.join(', ') : 'Unknown'}

### Content Snippet
${params.contentSnippet || '(no content available)'}`

  const clientsSection =
    params.clients.length > 0
      ? `## Available Clients

${params.clients.map(c => `- **${c.name}** (ID: ${c.id})`).join('\n')}`
      : ''

  const projectsSection =
    params.projects.length > 0
      ? `## Available Projects

${params.projects.map(p => `- **${p.name}** (ID: ${p.id}, Client: ${p.clientName})`).join('\n')}`
      : ''

  const leadsSection =
    params.leads.length > 0
      ? `## Available Leads

${params.leads.map(l => `- **${l.contactName}**${l.companyName ? ` (${l.companyName})` : ''} (ID: ${l.id})`).join('\n')}`
      : ''

  return `${transcriptSection}

${clientsSection}

${projectsSection}

${leadsSection}

Analyze this transcript and identify which client(s), project(s), or lead(s) it is most likely related to. Use the EXACT IDs shown above. Provide reasoning and confidence for each match.`
}
