import { and, desc, eq, isNull, isNotNull, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, meetings, threads, messages } from '@/lib/db/schema'
import { generateProposalDraft } from '@/lib/ai/proposal-draft'
import { extractLeadNotes } from '@/lib/leads/notes'

type RouteParams = { params: Promise<{ leadId: string }> }

/**
 * POST /api/leads/[leadId]/proposal/generate-draft
 * Generate a proposal draft using AI based on lead context.
 */
export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  assertAdmin(user)

  const { leadId } = await params

  try {
    // Fetch lead details
    const [lead] = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        companyName: leads.companyName,
        companyWebsite: leads.companyWebsite,
        notes: leads.notes,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
      .limit(1)

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch meetings with transcripts
    const meetingsWithTranscripts = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        transcriptText: meetings.transcriptText,
      })
      .from(meetings)
      .where(
        and(
          eq(meetings.leadId, leadId),
          isNull(meetings.deletedAt),
          isNotNull(meetings.transcriptText)
        )
      )
      .orderBy(desc(meetings.startsAt))
      .limit(5)

    // Fetch email threads and their latest messages
    const contactEmail = lead.contactEmail?.toLowerCase().trim()

    const threadRows = contactEmail
      ? await db
          .select({
            id: threads.id,
            subject: threads.subject,
          })
          .from(threads)
          .where(
            and(
              isNull(threads.deletedAt),
              or(
                eq(threads.leadId, leadId),
                // This is a simplified check - the actual listThreadsForLead uses SQL ANY()
              )
            )
          )
          .orderBy(desc(threads.lastMessageAt))
          .limit(10)
      : []

    // Fetch messages for the threads
    const threadIds = threadRows.map(t => t.id)
    let emailData: Array<{
      subject: string
      snippet: string
      fromEmail: string
      sentAt: string
      isInbound: boolean
    }> = []

    if (threadIds.length > 0) {
      const recentMessages = await db
        .select({
          threadId: messages.threadId,
          snippet: messages.snippet,
          fromEmail: messages.fromEmail,
          sentAt: messages.sentAt,
          isInbound: messages.isInbound,
        })
        .from(messages)
        .where(
          and(
            isNull(messages.deletedAt),
            // Include messages from our threads
            // Using SQL IN would be better but keeping simple for now
          )
        )
        .orderBy(desc(messages.sentAt))
        .limit(20)

      // Map to email format with thread subject
      const threadSubjectMap = new Map(threadRows.map(t => [t.id, t.subject]))
      emailData = recentMessages
        .filter(m => threadIds.includes(m.threadId))
        .map(m => ({
          subject: threadSubjectMap.get(m.threadId) || '(No subject)',
          snippet: m.snippet || '',
          fromEmail: m.fromEmail || '',
          sentAt: m.sentAt || '',
          isInbound: m.isInbound,
        }))
    }

    // Convert notes to plain text
    const notesHtml = extractLeadNotes(lead.notes)
    let notesText: string | null = null
    if (notesHtml && notesHtml !== '<p></p>') {
      // Simple HTML to text conversion (strips tags)
      notesText = notesHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Generate draft using AI
    const { draft, usage } = await generateProposalDraft({
      leadName: lead.contactName,
      companyName: lead.companyName,
      companyWebsite: lead.companyWebsite,
      notes: notesText,
      transcripts: meetingsWithTranscripts
        .filter(m => m.transcriptText)
        .map(m => ({
          title: m.title,
          date: m.startsAt,
          content: m.transcriptText!,
        })),
      emails: emailData,
    })

    return NextResponse.json({
      draft,
      context: {
        hasNotes: Boolean(notesText),
        transcriptCount: meetingsWithTranscripts.length,
        emailCount: emailData.length,
      },
      usage,
    })
  } catch (error) {
    console.error('Failed to generate proposal draft:', error)
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
