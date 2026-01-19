'use server'

import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, threads } from '@/lib/db/schema'
import { suggestLeadActions } from '@/lib/ai/lead-actions'
import { createSuggestion } from '@/lib/queries/suggestions'
import type { LeadSignal } from '@/lib/leads/intelligence-types'
import type { LeadActionSuggestedContent } from '@/lib/types/suggestions'

interface GenerateSuggestionsResult {
  success: boolean
  error?: string
  suggestionsCount?: number
}

export async function generateLeadSuggestions(
  leadId: string
): Promise<GenerateSuggestionsResult> {
  await requireRole('ADMIN')

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  // 2. Fetch linked threads
  const linkedThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      messageCount: threads.messageCount,
      lastMessageAt: threads.lastMessageAt,
    })
    .from(threads)
    .where(
      and(
        eq(threads.leadId, leadId),
        isNull(threads.deletedAt)
      )
    )

  try {
    // 3. Generate action suggestions with AI
    const { result } = await suggestLeadActions({
      lead: {
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        companyName: lead.companyName,
        status: lead.status,
        sourceType: lead.sourceType,
        notes: lead.notes ? JSON.stringify(lead.notes) : null,
        createdAt: lead.createdAt,
        lastContactAt: lead.lastContactAt,
        awaitingReply: lead.awaitingReply ?? false,
        overallScore: lead.overallScore ? Number(lead.overallScore) : null,
        priorityTier: lead.priorityTier,
      },
      threads: linkedThreads.map(t => ({
        id: t.id,
        subject: t.subject,
        messageCount: t.messageCount ?? 0,
        lastMessageAt: t.lastMessageAt ?? new Date().toISOString(),
      })),
      signals: Array.isArray(lead.signals)
        ? (lead.signals as LeadSignal[])
        : [],
    })

    // 4. Store each suggested action as a suggestion record
    const createdSuggestions = await Promise.all(
      result.actions.map(async action => {
        const suggestedContent: LeadActionSuggestedContent = {
          actionType: action.actionType,
          title: action.title,
          body: action.suggestedContent?.body,
          suggestedStatus: action.suggestedContent?.suggestedStatus,
          suggestedDueDate: action.suggestedContent?.dueDate,
          reasoning: action.reasoning,
        }

        return createSuggestion({
          leadId,
          type: action.actionType === 'REPLY' ? 'REPLY' : 'TASK',
          status: 'PENDING',
          confidence: action.confidence,
          reasoning: action.reasoning,
          suggestedContent,
        })
      })
    )

    revalidatePath('/leads/board')

    return {
      success: true,
      suggestionsCount: createdSuggestions.length,
    }
  } catch (error) {
    console.error('Failed to generate lead suggestions:', error)
    return {
      success: false,
      error: 'Failed to generate suggestions. Please try again.',
    }
  }
}
