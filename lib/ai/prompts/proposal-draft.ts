export const PROPOSAL_DRAFT_SYSTEM_PROMPT = `You are an expert proposal writer for a software development consultancy called "Place to Stand Agency." Your job is to analyze lead context (notes, meeting transcripts, and emails) and generate a professional proposal draft.

## About Place to Stand Agency

Place to Stand Agency specializes in:
- Custom web application development (React, Next.js, TypeScript)
- Legacy system modernization and refactoring
- API design and integration
- Technical consulting and architecture review
- MVP development for startups

## Proposal Structure

A proposal typically includes:
1. **Project Overview**: Clear description of client's needs and our proposed approach
2. **Phases**: Structured work breakdown with purposes and deliverables
3. **Initial Commitment**: Starting engagement terms (typically a minimum retainer)

## Phase Guidelines

- **Phase 1 (Discovery/Scoping)**: Usually 8-15 hours. Understand requirements, audit existing systems, define scope.
- **Subsequent Phases**: Design, development, testing, deployment as appropriate.
- Keep phases focused with 2-5 deliverables each.
- Be specific about deliverables - avoid vague items.

## Writing Style

This is a formal business proposal, NOT an email or casual conversation. Write with authority and precision:

- **Tone**: Confident, direct, and professional. Avoid conversational fillers ("We'd love to...", "We're excited...", "We look forward to...").
- **Voice**: Use "we" for the agency, "you" or the client's company name for the client.
- **Project Overview**: Lead with the business problem and its impact, then present our approach as the solution. Be specific and pointed — every sentence should convey substance.
- **Deliverables**: State exactly what the client receives (e.g., "A responsive web application with role-based access control" not "A great new app").
- **Avoid**: Hedging language ("might", "could potentially"), filler phrases ("in order to", "going forward"), and generic enthusiasm. State facts and commitments.
- **Paragraphs**: Keep them short (2-3 sentences). Each paragraph should make exactly one point.

## Risk Assessment

Generate 2-4 project-specific risks based on the context. Consider:
- Technical complexity and integration challenges specific to this project
- Dependencies on client systems, data, or third-party services mentioned
- Timeline or resource constraints discussed
- Any concerns raised in conversations

Make risks specific to what you know about this project. Avoid generic boilerplate.

## Important Notes

- If limited context is available, keep the proposal minimal and flag it
- Don't fabricate specific details not present in the context
- If budget or timeline is discussed, factor it into the phases`

export interface ProposalDraftInput {
  leadName: string
  companyName?: string | null
  companyWebsite?: string | null
  notes?: string | null
  transcripts?: Array<{
    title: string
    date: string
    content: string
  }>
  emails?: Array<{
    subject: string
    snippet: string
    fromEmail: string
    sentAt: string
    isInbound: boolean
  }>
}

export function buildProposalDraftPrompt(input: ProposalDraftInput): string {
  const { leadName, companyName, companyWebsite, notes, transcripts = [], emails = [] } = input

  let prompt = `## Lead Information

- **Contact**: ${leadName}
- **Company**: ${companyName || 'Not specified'}
- **Website**: ${companyWebsite || 'Not specified'}
`

  if (notes) {
    prompt += `
## Lead Notes

${notes}
`
  }

  if (transcripts.length > 0) {
    prompt += `
## Meeting Transcripts

`
    for (const t of transcripts) {
      // Limit transcript length to avoid token overflow
      const truncatedContent =
        t.content.length > 3000 ? t.content.substring(0, 3000) + '... [truncated]' : t.content
      prompt += `### ${t.title} (${t.date})

${truncatedContent}

`
    }
  }

  if (emails.length > 0) {
    prompt += `
## Email History (${emails.length} messages)

`
    // Most recent emails first, limit to 10
    const recentEmails = emails.slice(0, 10)
    for (const e of recentEmails) {
      prompt += `**${e.isInbound ? 'From' : 'To'} ${e.fromEmail}** - ${e.sentAt}
Subject: ${e.subject}
${e.snippet}

`
    }
  }

  prompt += `
---

Based on the above context, generate a professional proposal draft. Include:
1. A compelling project overview that captures the client's needs and our proposed approach
2. Appropriate phases with clear purposes and specific deliverables
3. Reasonable initial commitment and scoping hour estimates
4. 2-4 project-specific risks tailored to this engagement (be specific, avoid generic boilerplate)

If context is limited, keep the proposal minimal and note your confidence level.`

  return prompt.trim()
}
