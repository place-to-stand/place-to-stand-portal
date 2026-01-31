export const EMAIL_DRAFT_SYSTEM_PROMPT = `You are a professional email writer for Place to Stand Agency, a software development consultancy. Your job is to draft emails that sound natural, human, and specific to the relationship — never generic or templated.

## Your Role

You will receive:
1. A **template** that defines the email's intent and structure (follow-up, proposal, meeting request, introduction)
2. The **full relationship context** — emails, meeting transcripts, notes, lead data
3. The **recipient's details** — name, company, current stage in the pipeline

Use the template as a structural guide for what kind of email to write. Use the context to make it completely specific to this person and relationship.

## Writing Rules

- Write like a real person, not an AI. Short sentences. Natural flow.
- Reference specific details from conversations — a pain point they mentioned, a decision from the last call, a question they asked.
- Get to the point in the first sentence. No throat-clearing ("I hope this email finds you well").
- One clear call to action per email.
- Keep it concise — aim for 3-6 sentences for the body.
- Do NOT include greetings ("Hi Sarah,") or sign-offs ("Best, John") — those are added separately.
- Do NOT fabricate details not present in the context. If context is thin, keep the email brief and direct.
- Match the tone of the template — if it's casual, be casual. If formal, be formal.

## Subject Lines

- Specific, not generic. "Following up on the PowerBI integration discussion" not "Following up"
- Reference something real from the conversation when possible
- Keep under 60 characters`

export interface EmailDraftInput {
  // Template
  templateName: string
  templateCategory: string
  templateSubject: string
  templateBody: string

  // Recipient
  contactName: string
  contactEmail: string | null
  companyName: string | null
  companyWebsite: string | null

  // Sender
  senderName: string

  // Lead context
  leadStatus: string
  leadNotes: string | null
  lastContactAt: string | null
  awaitingReply: boolean

  // Conversation history
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

  // Proposal context
  proposalStatus?: string | null
  proposalTitle?: string | null
}

export function buildEmailDraftPrompt(input: EmailDraftInput): string {
  const {
    templateName,
    templateCategory,
    templateSubject,
    templateBody,
    contactName,
    companyName,
    companyWebsite,
    senderName,
    leadStatus,
    leadNotes,
    lastContactAt,
    awaitingReply,
    transcripts = [],
    emails = [],
    proposalStatus,
    proposalTitle,
  } = input

  let prompt = `## Template

**Name:** ${templateName}
**Category:** ${templateCategory}
**Subject pattern:** ${templateSubject}
**Structure/tone guide:**
${stripHtml(templateBody)}

---

## Recipient

- **Name:** ${contactName}
- **Company:** ${companyName || 'Not specified'}
- **Website:** ${companyWebsite || 'Not specified'}
- **Pipeline stage:** ${leadStatus}
- **Last contact:** ${lastContactAt || 'Unknown'}
- **Awaiting their reply:** ${awaitingReply ? 'Yes' : 'No'}

## Sender

- **Name:** ${senderName}
- **Company:** Place to Stand Agency
`

  if (proposalStatus) {
    prompt += `
## Proposal Status

- **Title:** ${proposalTitle || 'Untitled'}
- **Status:** ${proposalStatus}
`
  }

  if (leadNotes) {
    prompt += `
## Lead Notes

${leadNotes}
`
  }

  if (transcripts.length > 0) {
    prompt += `
## Meeting Transcripts

`
    for (const t of transcripts) {
      const truncated =
        t.content.length > 3000
          ? t.content.substring(0, 3000) + '... [truncated]'
          : t.content
      prompt += `### ${t.title} (${t.date})

${truncated}

`
    }
  }

  if (emails.length > 0) {
    prompt += `
## Email History (${emails.length} messages, most recent first)

`
    for (const e of emails.slice(0, 15)) {
      prompt += `**${e.isInbound ? 'From' : 'To'} ${e.fromEmail}** — ${e.sentAt}
Subject: ${e.subject}
${e.snippet}

`
    }
  }

  prompt += `
---

Draft an email following the template's intent and structure, personalized with the relationship context above. The subject should be specific to this conversation, not a copy of the template subject.`

  return prompt.trim()
}

/** Simple HTML tag stripping for template body */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
