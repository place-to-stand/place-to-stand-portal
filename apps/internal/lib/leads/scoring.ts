import 'server-only'

import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, messages, threads } from '@/lib/db/schema'
import { updateLeadScoring } from '@/lib/data/leads'
import { scoreLeadWithAI, shouldRescore } from '@/lib/ai/lead-scoring'
import type { EmailContext, LeadScoringInput } from '@/lib/ai/prompts/lead-scoring'
import type { LeadSignal } from '@/lib/leads/intelligence-types'

const MAX_EMAILS_FOR_SCORING = 20

export type LeadScoringOperationResult =
  | { success: true; scored: boolean; overallScore?: number; priorityTier?: string; predictedCloseProbability?: number }
  | { success: false; error: string }

/**
 * Core lead scoring logic - can be called from any server context.
 *
 * @param leadId - The ID of the lead to score
 * @param force - Force rescoring even if the lead was recently scored
 */
export async function performLeadScoring(
  leadId: string,
  force: boolean = false
): Promise<LeadScoringOperationResult> {
  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) {
    return { success: false, error: 'Lead not found' }
  }

  // Check if rescoring is needed (unless forced)
  if (!force && !shouldRescore(lead.lastScoredAt, lead.lastContactAt)) {
    return { success: true, scored: false }
  }

  // Use all threads linked to this lead for scoring
  const leadThreads = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.leadId, leadId), isNull(threads.deletedAt)))
  const threadIds = leadThreads.map(t => t.id)

  // Fetch messages from selected threads
  let emailContexts: EmailContext[] = []
  if (threadIds.length > 0) {
    const threadMessages = await db
      .select({
        subject: messages.subject,
        snippet: messages.snippet,
        fromEmail: messages.fromEmail,
        sentAt: messages.sentAt,
        isInbound: messages.isInbound,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.threadId, threadIds),
          isNull(messages.deletedAt)
        )
      )
      .orderBy(desc(messages.sentAt))
      .limit(MAX_EMAILS_FOR_SCORING)

    emailContexts = threadMessages.map(msg => ({
      subject: msg.subject ?? '',
      snippet: msg.snippet ?? '',
      fromEmail: msg.fromEmail ?? 'unknown',
      sentAt: msg.sentAt ?? new Date().toISOString(),
      isInbound: msg.isInbound ?? true,
    }))
  }

  // Build lead scoring input
  const leadInput: LeadScoringInput = {
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    companyName: lead.companyName,
    companyWebsite: lead.companyWebsite,
    status: lead.status,
    sourceType: lead.sourceType,
    sourceDetail: lead.sourceDetail,
    notes: typeof lead.notes === 'string' ? lead.notes : null,
    createdAt: lead.createdAt,
    lastContactAt: lead.lastContactAt,
    awaitingReply: lead.awaitingReply ?? false,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
  }

  // Parse existing signals if available
  const existingSignals = Array.isArray(lead.signals)
    ? (lead.signals as LeadSignal[]).map(s => ({ type: s.type, weight: s.weight }))
    : []

  try {
    // Call AI scoring
    const { result } = await scoreLeadWithAI({
      lead: leadInput,
      emails: emailContexts,
      existingSignals,
    })

    // Update lead with new scores
    await updateLeadScoring(leadId, {
      overallScore: result.overallScore,
      priorityTier: result.priorityTier,
      signals: result.signals,
      predictedCloseProbability: result.predictedCloseProbability,
    })

    return {
      success: true,
      scored: true,
      overallScore: result.overallScore,
      priorityTier: result.priorityTier,
      predictedCloseProbability: result.predictedCloseProbability,
    }
  } catch (error) {
    console.error('[performLeadScoring] Scoring failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Scoring failed',
    }
  }
}

// Re-export shouldRescore for convenience
export { shouldRescore } from '@/lib/ai/lead-scoring'
