import type { LeadSignal } from '@/lib/leads/intelligence-types'

export const LEAD_ACTIONS_SYSTEM_PROMPT = `You are an expert sales assistant that recommends next actions for leads in a CRM pipeline.

## Your Role

Analyze the lead's current state, email history, meeting transcripts, and signals to suggest the most impactful next actions. Pay special attention to meeting transcripts as they contain valuable context about the lead's needs, concerns, and timeline. Focus on actions that will:
1. Move the lead forward in the pipeline
2. Re-engage stalled leads
3. Capitalize on high-intent signals

## Action Types

- **FOLLOW_UP**: Create a follow-up task when:
  - No response for 3+ days on active leads
  - After sending initial outreach
  - After proposals or quotes
  - To check in on decision timeline

- **REPLY**: Draft a response when:
  - Lead has sent an unanswered email
  - Questions need addressing
  - Opportunity to provide value or information

- **SCHEDULE_CALL**: Recommend a call when:
  - Lead is qualified and engaged
  - Complex requirements need discussion
  - Decision-makers are involved
  - Moving from warm to hot stage

- **SEND_PROPOSAL**: Suggest sending proposal when:
  - Requirements are clearly defined
  - Budget has been discussed
  - Lead has expressed buying intent
  - Discovery is complete

- **ADVANCE_STATUS**: Recommend status change when:
  - Current status doesn't match lead activity
  - Lead has gone cold (no response 14+ days)
  - Significant engagement occurred
  - Deal is won/lost/unqualified

## Priority Levels

- **high**: Time-sensitive, should act within 24 hours
- **medium**: Important but can wait 2-3 days
- **low**: Nice to do when time permits

## Guidelines

1. Be specific and actionable in your recommendations
2. Consider the lead's current status and history
3. Don't suggest redundant or conflicting actions
4. Focus on 1-3 high-impact actions rather than many low-value ones
5. If lead is cold or unqualified, suggest minimal actions
6. Use meeting transcript context to reference specific topics, concerns, or follow-ups discussed
7. If a meeting mentioned next steps or action items, prioritize those in your suggestions`

export interface LeadForActions {
  contactName: string
  contactEmail?: string | null
  companyName?: string | null
  status: string
  sourceType?: string | null
  notes?: string | null
  createdAt: string
  lastContactAt?: string | null
  awaitingReply?: boolean
  overallScore?: number | null
  priorityTier?: string | null
}

export interface MessageForActions {
  fromEmail: string
  fromName: string | null
  sentAt: string
  isInbound: boolean
  snippet: string | null
  bodyPreview: string | null
}

export interface ThreadForActions {
  id: string
  subject: string | null
  messageCount: number
  lastMessageAt: string
  hasUnread?: boolean
  /** Recent messages in the thread (most recent first) */
  messages?: MessageForActions[]
}

export interface MeetingForActions {
  id: string
  title: string
  startsAt: string
  status: string
  /** Transcript or Gemini Notes content */
  transcriptText: string | null
}

export interface LeadActionsPromptParams {
  lead: LeadForActions
  threads?: ThreadForActions[]
  meetings?: MeetingForActions[]
  signals?: LeadSignal[]
}

export function buildLeadActionsPrompt(params: LeadActionsPromptParams): string {
  const { lead, threads = [], meetings = [], signals = [] } = params

  const now = new Date()
  const createdDate = new Date(lead.createdAt)
  const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

  let daysSinceContact = 'Never contacted'
  if (lead.lastContactAt) {
    const contactDate = new Date(lead.lastContactAt)
    const days = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24))
    daysSinceContact = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
  }

  const leadInfo = `
## Lead Information

- **Contact Name**: ${lead.contactName}
- **Email**: ${lead.contactEmail || 'Not provided'}
- **Company**: ${lead.companyName || 'Not provided'}
- **Current Status**: ${lead.status}
- **Source**: ${lead.sourceType || 'Unknown'}
- **Days Since Created**: ${daysSinceCreated}
- **Last Contact**: ${daysSinceContact}
- **Awaiting Reply**: ${lead.awaitingReply ? 'Yes - lead has not responded' : 'No'}
${lead.overallScore !== null ? `- **Score**: ${lead.overallScore}/100` : ''}
${lead.priorityTier ? `- **Priority Tier**: ${lead.priorityTier}` : ''}

### Notes
${lead.notes || 'No notes available.'}
`.trim()

  let threadsSection = ''
  if (threads.length > 0) {
    const threadDetails = threads.map(t => {
      let detail = `### Thread: "${t.subject || '(No subject)'}"
- Messages: ${t.messageCount}
- Last activity: ${t.lastMessageAt}${t.hasUnread ? ' (UNREAD)' : ''}`

      if (t.messages && t.messages.length > 0) {
        const messageList = t.messages
          .slice(0, 5) // Limit to 5 most recent messages per thread
          .map(m => {
            const sender = m.isInbound
              ? `${m.fromName || m.fromEmail} (lead)`
              : 'You (sent)'
            const content = m.bodyPreview || m.snippet || '(empty)'
            // Truncate long messages
            const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content
            return `**${sender}** (${m.sentAt}):\n${truncated}`
          })
          .join('\n\n')

        detail += `\n\n#### Recent Messages:\n${messageList}`
      }

      return detail
    }).join('\n\n---\n\n')

    threadsSection = `
## Email Conversation History (${threads.length} thread${threads.length > 1 ? 's' : ''})

${threadDetails}
`.trim()
  }

  let meetingsSection = ''
  if (meetings.length > 0) {
    const meetingDetails = meetings.map(m => {
      const meetingDate = new Date(m.startsAt)
      const dateStr = meetingDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      let detail = `### Meeting: "${m.title}"
- Date: ${dateStr}
- Status: ${m.status}`

      if (m.transcriptText) {
        // Truncate very long transcripts
        const truncated = m.transcriptText.length > 3000
          ? m.transcriptText.slice(0, 3000) + '\n\n... (transcript truncated)'
          : m.transcriptText
        detail += `\n\n#### Transcript/Notes:\n${truncated}`
      }

      return detail
    }).join('\n\n---\n\n')

    meetingsSection = `
## Meeting History (${meetings.length} meeting${meetings.length > 1 ? 's' : ''})

${meetingDetails}
`.trim()
  }

  let signalsSection = ''
  if (signals.length > 0) {
    const signalList = signals
      .map(s => `- ${s.type} (weight: ${s.weight})${s.details?.note ? `: ${s.details.note}` : ''}`)
      .join('\n')

    signalsSection = `
## Detected Signals
${signalList}
`.trim()
  }

  return `
${leadInfo}

${threadsSection}

${meetingsSection}

${signalsSection}

---

Based on the lead's current state, suggest the most impactful next actions. Focus on high-value actions that will move this lead forward.
`.trim()
}
