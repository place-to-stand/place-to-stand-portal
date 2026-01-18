'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { leadScoredEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { scoreLeadWithAI } from '@/lib/ai/lead-scoring'
import type { PriorityTier, LeadSignal } from '@/lib/leads/intelligence-types'

interface ScoreLeadResult {
  success: boolean
  error?: string
  score?: number
  priorityTier?: PriorityTier
  signals?: LeadSignal[]
}

export async function scoreLead(leadId: string): Promise<ScoreLeadResult> {
  const user = await requireRole('ADMIN')

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  try {
    // 2. Score the lead with AI
    const { result } = await scoreLeadWithAI({
      lead: {
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        companyName: lead.companyName,
        companyWebsite: lead.companyWebsite,
        status: lead.status,
        sourceType: lead.sourceType,
        sourceDetail: lead.sourceDetail,
        notes: lead.notes ? JSON.stringify(lead.notes) : null,
        createdAt: lead.createdAt,
        lastContactAt: lead.lastContactAt,
        awaitingReply: lead.awaitingReply ?? false,
      },
      existingSignals: Array.isArray(lead.signals)
        ? (lead.signals as { type: string; weight: number }[])
        : [],
    })

    const previousScore = lead.overallScore ? Number(lead.overallScore) : null

    // 3. Convert AI signals to our LeadSignal format
    const signals: LeadSignal[] = result.signals.map(s => ({
      type: s.type,
      timestamp: new Date().toISOString(),
      weight: s.weight,
      details: s.details ? { note: s.details } : undefined,
    }))

    // 4. Update the lead with scoring data
    await db
      .update(leads)
      .set({
        overallScore: result.overallScore.toFixed(2),
        priorityTier: result.priorityTier,
        signals,
        lastScoredAt: new Date().toISOString(),
        predictedCloseProbability: result.predictedCloseProbability
          ? result.predictedCloseProbability.toFixed(2)
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))

    // 5. Log activity
    const event = leadScoredEvent({
      contactName: lead.contactName,
      previousScore,
      newScore: result.overallScore,
      signalCount: signals.length,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'LEAD',
      targetId: leadId,
      metadata: event.metadata,
    })

    revalidatePath('/leads/board')

    return {
      success: true,
      score: result.overallScore,
      priorityTier: result.priorityTier,
      signals,
    }
  } catch (error) {
    console.error('Failed to score lead:', error)
    return {
      success: false,
      error: 'Failed to score lead. Please try again.',
    }
  }
}
