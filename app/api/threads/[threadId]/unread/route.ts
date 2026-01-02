import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { markGmailMessageAsUnread } from '@/lib/gmail/client'

type RouteParams = {
  params: Promise<{ threadId: string }>
}

/**
 * POST /api/threads/[threadId]/unread
 * Mark all messages in a thread as unread (both in database and Gmail)
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await params
  console.log(`[mark-unread] POST /api/threads/${threadId}/unread called by user ${user.id}`)

  try {
    // Get all read messages in the thread that belong to this user
    const readMessages = await db
      .select({
        id: messages.id,
        externalMessageId: messages.externalMessageId,
      })
      .from(messages)
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.userId, user.id),
          eq(messages.isRead, true),
          isNull(messages.deletedAt)
        )
      )

    if (readMessages.length === 0) {
      return NextResponse.json({ ok: true, markedCount: 0 })
    }

    // Mark all as unread in database
    await db
      .update(messages)
      .set({
        isRead: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.userId, user.id),
          isNull(messages.deletedAt)
        )
      )

    // Try to mark as unread in Gmail
    const messagesToSync = readMessages.filter(m => m.externalMessageId)
    console.log(`[mark-unread] Syncing ${messagesToSync.length} messages to Gmail for thread ${threadId}`)

    for (const m of messagesToSync) {
      try {
        await markGmailMessageAsUnread(user.id, m.externalMessageId!)
        console.log(`[mark-unread] Successfully marked ${m.externalMessageId} as unread in Gmail`)
      } catch (err) {
        console.error(`[mark-unread] Failed to mark Gmail message ${m.externalMessageId} as unread:`, err)
      }
    }

    return NextResponse.json({ ok: true, markedCount: readMessages.length })
  } catch (error) {
    console.error('Failed to mark thread as unread:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to mark as unread' },
      { status: 500 }
    )
  }
}
