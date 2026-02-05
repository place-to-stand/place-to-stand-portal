'use server'

import { eq, and, isNull, or, sql, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, threads, messages, meetings, suggestions } from '@/lib/db/schema'
import { suggestLeadActions } from '@/lib/ai/lead-actions'
import { createSuggestion } from '@/lib/queries/suggestions'
import type { LeadSignal } from '@/lib/leads/intelligence-types'
import type { LeadActionSuggestedContent, LinkEmailSuggestedContent, LinkTranscriptSuggestedContent } from '@/lib/types/suggestions'
import type { MessageForActions, ThreadForActions, MeetingForActions } from '@/lib/ai/prompts/lead-actions'

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

  // 2. Fetch threads linked to this lead (by lead_id OR by contact email match)
  const contactEmail = lead.contactEmail?.toLowerCase().trim()

  const linkedThreadRows = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      messageCount: threads.messageCount,
      lastMessageAt: threads.lastMessageAt,
    })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        contactEmail
          ? or(
              eq(threads.leadId, leadId),
              sql`lower(${contactEmail}) = ANY(${threads.participantEmails})`
            )
          : eq(threads.leadId, leadId)
      )
    )
    .orderBy(desc(threads.lastMessageAt))
    .limit(10) // Limit to 10 most recent threads

  // 3. Fetch recent messages for each thread
  const threadIds = linkedThreadRows.map(t => t.id)
  const threadMessages = threadIds.length > 0
    ? await db
        .select({
          id: messages.id,
          threadId: messages.threadId,
          fromEmail: messages.fromEmail,
          fromName: messages.fromName,
          sentAt: messages.sentAt,
          isInbound: messages.isInbound,
          snippet: messages.snippet,
          bodyText: messages.bodyText,
        })
        .from(messages)
        .where(
          and(
            inArray(messages.threadId, threadIds),
            isNull(messages.deletedAt)
          )
        )
        .orderBy(desc(messages.sentAt))
    : []

  // Group messages by thread and build thread objects with message content
  const messagesByThread = new Map<string, typeof threadMessages>()
  for (const msg of threadMessages) {
    if (!messagesByThread.has(msg.threadId)) {
      messagesByThread.set(msg.threadId, [])
    }
    messagesByThread.get(msg.threadId)!.push(msg)
  }

  const linkedThreads: ThreadForActions[] = linkedThreadRows.map(t => {
    const msgs = messagesByThread.get(t.id) || []
    const hasUnread = msgs.some(m => m.isInbound) // Simplified unread check

    return {
      id: t.id,
      subject: t.subject,
      messageCount: t.messageCount ?? 0,
      lastMessageAt: t.lastMessageAt ?? new Date().toISOString(),
      hasUnread,
      messages: msgs.slice(0, 5).map((m): MessageForActions => ({
        fromEmail: m.fromEmail,
        fromName: m.fromName,
        sentAt: m.sentAt,
        isInbound: m.isInbound,
        snippet: m.snippet,
        // Extract first 1000 chars of body as preview
        bodyPreview: m.bodyText ? m.bodyText.slice(0, 1000) : null,
      })),
    }
  })

  // 4. Fetch meetings with transcripts for this lead
  const leadMeetings = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      status: meetings.status,
      transcriptText: meetings.transcriptText,
      transcriptStatus: meetings.transcriptStatus,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.leadId, leadId),
        isNull(meetings.deletedAt)
      )
    )
    .orderBy(desc(meetings.startsAt))
    .limit(5) // Limit to 5 most recent meetings

  // Filter to only meetings that have transcripts and format for AI
  const meetingsWithTranscripts: MeetingForActions[] = leadMeetings
    .filter(m => m.transcriptStatus === 'FETCHED' && m.transcriptText)
    .map(m => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      status: m.status,
      transcriptText: m.transcriptText,
    }))

  try {
    // 5. Generate action suggestions with AI
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
      threads: linkedThreads,
      meetings: meetingsWithTranscripts,
      signals: Array.isArray(lead.signals)
        ? (lead.signals as LeadSignal[])
        : [],
    })

    // 5. Store each suggested action as a suggestion record
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

    // 6. Auto-create LINK_EMAIL_THREAD suggestions for threads without one
    const existingThreadSuggestions = await db
      .select({ threadId: sql<string>`${suggestions.suggestedContent}->>'threadId'` })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.leadId, leadId),
          isNull(suggestions.deletedAt),
          sql`${suggestions.suggestedContent}->>'actionType' = 'LINK_EMAIL_THREAD'`
        )
      )
    const existingThreadIds = new Set(existingThreadSuggestions.map(s => s.threadId))

    const newThreadSuggestions = await Promise.all(
      linkedThreadRows
        .filter(t => !existingThreadIds.has(t.id))
        .map(t => {
          const msgs = messagesByThread.get(t.id) || []
          const latestMsg = msgs[0]
          const content: LinkEmailSuggestedContent = {
            actionType: 'LINK_EMAIL_THREAD',
            title: t.subject || 'Untitled Thread',
            threadId: t.id,
            snippet: latestMsg?.snippet || '',
            participantCount: 0,
            messageCount: t.messageCount ?? 0,
            lastMessageAt: t.lastMessageAt || new Date().toISOString(),
            reasoning: 'Email thread associated with this lead. Approve to include in AI scoring context.',
          }
          return createSuggestion({
            leadId,
            threadId: t.id,
            type: 'TASK',
            status: 'PENDING',
            confidence: 0.8,
            reasoning: content.reasoning,
            suggestedContent: content,
          })
        })
    )

    // 7. Auto-create LINK_TRANSCRIPT suggestions for meetings without one
    const existingMeetingSuggestions = await db
      .select({ meetingId: sql<string>`${suggestions.suggestedContent}->>'meetingId'` })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.leadId, leadId),
          isNull(suggestions.deletedAt),
          sql`${suggestions.suggestedContent}->>'actionType' = 'LINK_TRANSCRIPT'`
        )
      )
    const existingMeetingIds = new Set(existingMeetingSuggestions.map(s => s.meetingId))

    const newTranscriptSuggestions = await Promise.all(
      meetingsWithTranscripts
        .filter(m => !existingMeetingIds.has(m.id))
        .map(m => {
          const content: LinkTranscriptSuggestedContent = {
            actionType: 'LINK_TRANSCRIPT',
            title: m.title || 'Untitled Meeting',
            meetingId: m.id,
            date: m.startsAt,
            snippetPreview: m.transcriptText ? m.transcriptText.slice(0, 200) : '',
            reasoning: 'Meeting transcript available. Approve to include in AI scoring context.',
          }
          return createSuggestion({
            leadId,
            type: 'TASK',
            status: 'PENDING',
            confidence: 0.8,
            reasoning: content.reasoning,
            suggestedContent: content,
          })
        })
    )

    revalidatePath('/leads/board')

    return {
      success: true,
      suggestionsCount: createdSuggestions.length + newThreadSuggestions.length + newTranscriptSuggestions.length,
    }
  } catch (error) {
    console.error('Failed to generate lead suggestions:', error)
    return {
      success: false,
      error: 'Failed to generate suggestions. Please try again.',
    }
  }
}
