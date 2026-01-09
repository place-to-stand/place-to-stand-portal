import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { markGmailMessageAsRead } from '@/lib/gmail/client'

type RouteParams = {
  params: Promise<{ threadId: string }>
}

/**
 * POST /api/threads/[threadId]/read
 * Mark all messages in a thread as read (both in database and Gmail)
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await params
  console.log(`[mark-read] POST /api/threads/${threadId}/read called by user ${user.id}`)

  try {
    // Get all unread messages in the thread that belong to this user
    const unreadMessages = await db
      .select({
        id: messages.id,
        externalMessageId: messages.externalMessageId,
      })
      .from(messages)
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.userId, user.id),
          eq(messages.isRead, false),
          isNull(messages.deletedAt)
        )
      )

    if (unreadMessages.length === 0) {
      return NextResponse.json({ ok: true, markedCount: 0 })
    }

    // Mark all as read in database
    await db
      .update(messages)
      .set({
        isRead: true,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.userId, user.id),
          isNull(messages.deletedAt)
        )
      )

    // Try to mark as read in Gmail
    const messagesToSync = unreadMessages.filter(m => m.externalMessageId)
    console.log(`[mark-read] Syncing ${messagesToSync.length} messages to Gmail for thread ${threadId}`)

    for (const m of messagesToSync) {
      try {
        await markGmailMessageAsRead(user.id, m.externalMessageId!)
        console.log(`[mark-read] Successfully marked ${m.externalMessageId} as read in Gmail`)
      } catch (err) {
        console.error(`[mark-read] Failed to mark Gmail message ${m.externalMessageId} as read:`, err)
      }
    }

    return NextResponse.json({ ok: true, markedCount: unreadMessages.length })
  } catch (error) {
    console.error('Failed to mark thread as read:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to mark as read' },
      { status: 500 }
    )
  }
}
