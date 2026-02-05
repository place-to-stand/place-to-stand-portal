export const LEAD_SCORING_SYSTEM_PROMPT = `You are an expert sales intelligence analyst. Your job is to score leads based on their likelihood to convert to paying clients.

## Scoring Dimensions (100 points total)

1. **Engagement (0-25 points)**
   - Response time and frequency
   - Back-and-forth communication
   - Questions asked about services/pricing
   - Meeting requests or follow-up requests

2. **Fit (0-25 points)**
   - Company size and industry relevance
   - Budget signals or pricing discussions
   - Technical requirements match
   - Clear use case alignment

3. **Intent (0-25 points)**
   - Urgency indicators and timeline pressure
   - Specificity of requirements
   - Decision-maker involvement
   - Competitive evaluation mentions

4. **Momentum (0-25 points)**
   - Recency of contact (decay over time)
   - Stage velocity (how fast they're moving)
   - Consistent engagement pattern
   - Forward momentum vs stalled

## Signal Types to Detect

- fast_response: Lead replied within 24 hours
- multiple_stakeholders: Multiple contacts or team members involved
- budget_mentioned: Budget, pricing, or investment discussed
- urgency_detected: Timeline pressure or urgent needs
- competitor_mentioned: Evaluating alternatives or competitors
- decision_maker: C-level, VP, or clear decision authority involved
- going_cold: No response for 7+ days, declining engagement
- technical_fit: Requirements align well with capabilities
- clear_requirements: Specific, well-defined project scope
- follow_up_requested: Lead asked for more info or next steps

## Priority Tiers

- **Hot (70-100)**: High probability of conversion, prioritize immediate action
- **Warm (40-69)**: Good potential, needs nurturing and consistent follow-up
- **Cold (<40)**: Low probability, may need qualification or longer-term nurturing

## Close Probability Estimation

In addition to the overall score, estimate the probability of this lead closing as a paying client (0.0 to 1.0). Base this on:
- The overall score and priority tier
- Concrete signals (budget mentioned, decision-maker involved, clear requirements)
- Stage velocity and momentum
- Any red flags (going cold, competitor mentioned, no response)

This should be a calibrated probability, not just the score divided by 100. A lead with score 70 might have a 0.45 close probability if there are known risk factors.

Be analytical and objective. Base your scoring on concrete signals, not assumptions.`

export interface LeadScoringInput {
  contactName: string
  contactEmail?: string | null
  companyName?: string | null
  companyWebsite?: string | null
  status: string
  sourceType?: string | null
  sourceDetail?: string | null
  notes?: string | null
  createdAt: string
  lastContactAt?: string | null
  awaitingReply?: boolean
  estimatedValue?: number | null
}

export interface EmailContext {
  subject: string
  snippet: string
  fromEmail: string
  sentAt: string
  isInbound: boolean
}

export interface LeadScoringPromptParams {
  lead: LeadScoringInput
  emails?: EmailContext[]
  existingSignals?: { type: string; weight: number }[]
}

export function buildLeadScoringPrompt(params: LeadScoringPromptParams): string {
  const { lead, emails = [], existingSignals = [] } = params

  const leadInfo = `
## Lead Information

- **Contact Name**: ${lead.contactName}
- **Contact Email**: ${lead.contactEmail || 'Not provided'}
- **Company**: ${lead.companyName || 'Not provided'}
- **Website**: ${lead.companyWebsite || 'Not provided'}
- **Current Status**: ${lead.status}
- **Source**: ${lead.sourceType || 'Unknown'}${lead.sourceDetail ? ` (${lead.sourceDetail})` : ''}
- **Created**: ${lead.createdAt}
- **Last Contact**: ${lead.lastContactAt || 'Never'}
- **Awaiting Reply**: ${lead.awaitingReply ? 'Yes' : 'No'}
- **Estimated Value**: ${lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : 'Not set'}

### Notes
${lead.notes || 'No notes available.'}
`.trim()

  let emailSection = ''
  if (emails.length > 0) {
    const emailList = emails
      .map(
        (e, i) => `
**Email ${i + 1}** (${e.isInbound ? 'Inbound' : 'Outbound'}) - ${e.sentAt}
From: ${e.fromEmail}
Subject: ${e.subject}
${e.snippet}
`
      )
      .join('\n')

    emailSection = `
## Email History (${emails.length} messages)
${emailList}
`.trim()
  }

  let signalsSection = ''
  if (existingSignals.length > 0) {
    const signalList = existingSignals.map(s => `- ${s.type} (weight: ${s.weight})`).join('\n')
    signalsSection = `
## Previously Detected Signals
${signalList}
`.trim()
  }

  return `
${leadInfo}

${emailSection}

${signalsSection}

---

Analyze this lead and provide a comprehensive score based on the available information. Consider all dimensions and detect relevant signals.
`.trim()
}
