/**
 * Standalone script to score all leads using AI.
 * Works outside Next.js environment.
 *
 * Run with: DATABASE_URL='...' npx tsx scripts/score-all-leads.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output } from 'ai'
import { z } from 'zod'

type LeadRow = {
  id: string
  contact_name: string
  contact_email: string | null
  company_name: string | null
  company_website: string | null
  status: string
  source_type: string | null
  source_detail: string | null
  notes: unknown
  created_at: string
  last_contact_at: string | null
  awaiting_reply: boolean | null
  overall_score: number | null
  priority_tier: string | null
  estimated_value: string | null
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY
if (!AI_GATEWAY_API_KEY) {
  throw new Error('AI_GATEWAY_API_KEY environment variable is required')
}

const sql = postgres(DATABASE_URL, {
  ssl: DATABASE_URL.includes('supabase') ? 'require' : undefined,
})

// AI Setup
const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

// Exact schema from lib/ai/schemas/lead-scoring.ts
const leadSignalSchema = z.object({
  type: z
    .string()
    .describe(
      'Signal type: fast_response, multiple_stakeholders, budget_mentioned, urgency_detected, competitor_mentioned, decision_maker, going_cold, technical_fit, clear_requirements, follow_up_requested'
    ),
  weight: z.number().min(0).max(1).describe('Weight contribution to overall score (0-1)'),
  details: z.string().optional().describe('Brief explanation of the signal'),
})

const leadScoringResultSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Overall lead quality score from 0-100'),
  priorityTier: z
    .enum(['hot', 'warm', 'cold'])
    .describe('Priority tier: hot (70+), warm (40-69), cold (<40)'),
  signals: z
    .array(leadSignalSchema)
    .describe('Detected signals that contribute to the score'),
  reasoning: z
    .string()
    .max(500)
    .describe('Brief explanation of the scoring rationale'),
  suggestedNextAction: z
    .string()
    .optional()
    .describe('Recommended next action for this lead'),
  predictedCloseProbability: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Calibrated probability of closing this deal (0-1). Not simply score/100 — factor in concrete risk signals, stage, and momentum.'
    ),
})

// Exact system prompt from lib/ai/prompts/lead-scoring.ts
const SYSTEM_PROMPT = `You are an expert sales intelligence analyst. Your job is to score leads based on their likelihood to convert to paying clients.

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

async function scoreLead(lead: {
  id: string
  contact_name: string
  contact_email: string | null
  company_name: string | null
  company_website: string | null
  status: string
  source_type: string | null
  source_detail: string | null
  notes: unknown
  created_at: string
  last_contact_at: string | null
  awaiting_reply: boolean | null
  estimated_value: string | null
}) {
  // Fetch email threads for this lead
  const threads = await sql`
    SELECT id FROM threads WHERE lead_id = ${lead.id} AND deleted_at IS NULL
  `

  let emailContext = ''
  if (threads.length > 0) {
    const threadIds = threads.map((t) => t.id)
    const messages = await sql`
      SELECT subject, snippet, from_email, sent_at, is_inbound
      FROM messages
      WHERE thread_id = ANY(${threadIds})
        AND deleted_at IS NULL
      ORDER BY sent_at DESC
      LIMIT 20
    `

    if (messages.length > 0) {
      emailContext = `\n\n## Email History (${messages.length} messages)\n`
      messages.forEach((msg, i) => {
        emailContext += `\n**Email ${i + 1}** (${msg.is_inbound ? 'Inbound' : 'Outbound'}) - ${msg.sent_at}\nFrom: ${msg.from_email}\nSubject: ${msg.subject}\n${msg.snippet}\n`
      })
    }
  }

  // Extract notes text
  let notesText = 'No notes available.'
  if (lead.notes && typeof lead.notes === 'object') {
    const notes = lead.notes as { content?: Array<{ content?: Array<{ text?: string }> }> }
    if (notes.content) {
      notesText = notes.content
        .flatMap((block) => block.content?.map((c) => c.text) || [])
        .filter(Boolean)
        .join(' ')
    }
  }

  const prompt = `
## Lead Information

- **Contact Name**: ${lead.contact_name}
- **Contact Email**: ${lead.contact_email || 'Not provided'}
- **Company**: ${lead.company_name || 'Not provided'}
- **Website**: ${lead.company_website || 'Not provided'}
- **Current Status**: ${lead.status}
- **Source**: ${lead.source_type || 'Unknown'}${lead.source_detail ? ` (${lead.source_detail})` : ''}
- **Created**: ${lead.created_at}
- **Last Contact**: ${lead.last_contact_at || 'Never'}
- **Awaiting Reply**: ${lead.awaiting_reply ? 'Yes' : 'No'}
- **Estimated Value**: ${lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : 'Not set'}

### Notes
${notesText}
${emailContext}

---

Analyze this lead and provide a comprehensive score.`

  const { output } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: leadScoringResultSchema }),
  })

  return output!
}

async function main() {
  console.log('🎯 Starting bulk lead scoring...\n')

  // Fetch all leads
  const leadsToScore = await sql<LeadRow[]>`
    SELECT
      id, contact_name, contact_email, company_name, company_website,
      status, source_type, source_detail, notes, created_at,
      last_contact_at, awaiting_reply, overall_score, priority_tier, estimated_value
    FROM leads
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `

  console.log(`Found ${leadsToScore.length} leads total\n`)

  let scored = 0
  const skipped = 0
  let failed = 0

  for (const lead of leadsToScore) {
    const hasScore = lead.overall_score !== null && lead.priority_tier !== null
    const prefix = hasScore ? '🔄' : '🆕'

    console.log(`${prefix} ${lead.contact_name}...`)

    try {
      const result = await scoreLead(lead)

      // Update the lead
      const timestamp = new Date().toISOString()
      await sql`
        UPDATE leads
        SET
          overall_score = ${result.overallScore.toFixed(2)},
          priority_tier = ${result.priorityTier},
          signals = ${JSON.stringify(result.signals)}::jsonb,
          predicted_close_probability = ${result.predictedCloseProbability.toFixed(2)},
          last_scored_at = ${timestamp},
          updated_at = ${timestamp}
        WHERE id = ${lead.id}
      `

      console.log(`   ✅ Score: ${result.overallScore} | Tier: ${result.priorityTier} | Close: ${(result.predictedCloseProbability * 100).toFixed(0)}%`)
      scored++
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      failed++
    }

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log('\n📊 Summary:')
  console.log(`  Scored: ${scored}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total:  ${leadsToScore.length}`)

  await sql.end()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
