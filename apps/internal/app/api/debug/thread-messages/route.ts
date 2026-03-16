import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { threads, messages } from '@/lib/db/schema'
import { eq, isNull, and, desc, sql } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'

/**
 * GET /api/debug/thread-messages?threadId=xxx
 * Debug endpoint to check thread/message data directly
 */
export async function GET(request: Request) {
  await requireRole('ADMIN')

  const { searchParams } = new URL(request.url)
  const threadId = searchParams.get('threadId')

  if (!threadId) {
    // Return summary of all threads with message counts
    const summary = await db
      .select({
        threadId: threads.id,
        subject: threads.subject,
        cachedMessageCount: threads.messageCount,
        actualMessageCount: sql<number>`(
          SELECT COUNT(*) FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.deleted_at IS NULL
        )::int`,
      })
      .from(threads)
      .where(isNull(threads.deletedAt))
      .orderBy(desc(threads.lastMessageAt))
      .limit(20)

    return NextResponse.json({
      summary,
      note: 'Add ?threadId=xxx to check a specific thread'
    })
  }

  // Get specific thread
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1)

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found', threadId }, { status: 404 })
  }

  // Get messages for this thread
  const threadMessages = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      userId: messages.userId,
      fromEmail: messages.fromEmail,
      subject: messages.subject,
      sentAt: messages.sentAt,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.sentAt)
    .limit(10)

  // Also check if there are any messages without the deletedAt filter
  const allMessagesForThread = await db
    .select({ id: messages.id, deletedAt: messages.deletedAt })
    .from(messages)
    .where(eq(messages.threadId, threadId))

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      messageCount: thread.messageCount,
      leadId: thread.leadId,
      participantEmails: thread.participantEmails,
      externalThreadId: thread.externalThreadId,
    },
    messagesFound: threadMessages.length,
    messagesIncludingDeleted: allMessagesForThread.length,
    messages: threadMessages,
  })
}
