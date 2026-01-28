import { and, desc, eq, isNull, isNotNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, meetings, threads, messages, proposals } from '@/lib/db/schema'
import { generateEmailDraft } from '@/lib/ai/email-draft'
import { extractLeadNotes } from '@/lib/leads/notes'

type RouteParams = { params: Promise<{ leadId: string }> }

const requestSchema = z.object({
  templateName: z.string(),
  templateCategory: z.string(),
  templateSubject: z.string(),
  templateBody: z.string(),
})

/**
 * POST /api/leads/[leadId]/email/generate-draft
 *
 * Generate a personalized email draft using AI.
 * Takes a template + gathers full lead context → returns a draft.
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  assertAdmin(user)

  const { leadId } = await params
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const template = parsed.data

  try {
    // 1. Fetch lead
    const [lead] = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        companyName: leads.companyName,
        companyWebsite: leads.companyWebsite,
        status: leads.status,
        notes: leads.notes,
        lastContactAt: leads.lastContactAt,
        awaitingReply: leads.awaitingReply,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
      .limit(1)

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // 2. Fetch meetings with transcripts
    const meetingsWithTranscripts = await db
      .select({
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

    // 3. Fetch email threads and messages
    const threadRows = await db
      .select({
        id: threads.id,
        subject: threads.subject,
      })
      .from(threads)
      .where(
        and(
          isNull(threads.deletedAt),
          eq(threads.leadId, leadId)
        )
      )
      .orderBy(desc(threads.lastMessageAt))
      .limit(10)

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
        .where(isNull(messages.deletedAt))
        .orderBy(desc(messages.sentAt))
        .limit(30)

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

    // 4. Fetch latest proposal status
    const [latestProposal] = await db
      .select({
        title: proposals.title,
        status: proposals.status,
      })
      .from(proposals)
      .where(and(eq(proposals.leadId, leadId), isNull(proposals.deletedAt)))
      .orderBy(desc(proposals.createdAt))
      .limit(1)

    // 5. Extract notes
    const notesHtml = extractLeadNotes(lead.notes)
    let notesText: string | null = null
    if (notesHtml && notesHtml !== '<p></p>') {
      notesText = notesHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // 6. Generate draft
    const { draft, usage } = await generateEmailDraft({
      templateName: template.templateName,
      templateCategory: template.templateCategory,
      templateSubject: template.templateSubject,
      templateBody: template.templateBody,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      companyName: lead.companyName,
      companyWebsite: lead.companyWebsite,
      senderName: user.full_name ?? user.email,
      leadStatus: lead.status,
      leadNotes: notesText,
      lastContactAt: lead.lastContactAt,
      awaitingReply: lead.awaitingReply ?? false,
      transcripts: meetingsWithTranscripts
        .filter(m => m.transcriptText)
        .map(m => ({
          title: m.title,
          date: m.startsAt,
          content: m.transcriptText!,
        })),
      emails: emailData,
      proposalStatus: latestProposal?.status ?? null,
      proposalTitle: latestProposal?.title ?? null,
    })

    return NextResponse.json({ draft, usage })
  } catch (error) {
    console.error('Failed to generate email draft:', error)
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
