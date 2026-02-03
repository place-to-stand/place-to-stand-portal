import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { oauthConnections, threads, messages } from '@/lib/db/schema'
import { eq, and, isNull, sql, count } from 'drizzle-orm'
import { requireUser } from '@/lib/auth/session'
import { syncGmailForUser } from '@/lib/email/sync'
import { getValidAccessToken, listMessages } from '@/lib/gmail/client'

/**
 * GET /api/debug/gmail-sync
 * Debug endpoint to check Gmail sync status and attempt sync
 */
export async function GET(_request: Request) {
  const user = await requireUser()

  // Get OAuth connection status
  const [conn] = await db
    .select({
      id: oauthConnections.id,
      status: oauthConnections.status,
      accessTokenExpiresAt: oauthConnections.accessTokenExpiresAt,
      lastSyncAt: oauthConnections.lastSyncAt,
      syncState: oauthConnections.syncState,
      scopes: oauthConnections.scopes,
      hasRefreshToken: oauthConnections.refreshToken,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE')
      )
    )
    .limit(1)

  if (!conn) {
    return NextResponse.json({
      error: 'No Google OAuth connection found',
      suggestion: 'Go to Settings > Integrations and connect your Google account',
    })
  }

  // Check if token is valid
  let tokenStatus = 'unknown'
  let tokenError: string | null = null
  try {
    await getValidAccessToken(user.id)
    tokenStatus = 'valid'
  } catch (err) {
    tokenStatus = 'invalid'
    tokenError = err instanceof Error ? err.message : 'Unknown error'
  }

  // Test Gmail API with a single call
  let apiTestResult: { success: boolean; messageCount?: number; error?: string } = { success: false }
  if (tokenStatus === 'valid') {
    try {
      const testList = await listMessages(user.id, { maxResults: 1 })
      apiTestResult = {
        success: true,
        messageCount: testList.resultSizeEstimate ?? 0,
      }
    } catch (err) {
      apiTestResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  // Find duplicate threads (same externalThreadId)
  const duplicateThreads = await db
    .select({
      externalThreadId: threads.externalThreadId,
      count: count(),
    })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        sql`${threads.externalThreadId} IS NOT NULL`
      )
    )
    .groupBy(threads.externalThreadId)
    .having(sql`count(*) > 1`)
    .limit(10)

  // Find threads with 0 messages
  const emptyThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      externalThreadId: threads.externalThreadId,
      messageCount: threads.messageCount,
      createdAt: threads.createdAt,
    })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        eq(threads.messageCount, 0)
      )
    )
    .limit(10)

  // Count total threads vs total messages
  const [[threadStats], [messageStats]] = await Promise.all([
    db.select({ total: count() }).from(threads).where(isNull(threads.deletedAt)),
    db.select({ total: count() }).from(messages).where(and(eq(messages.userId, user.id), isNull(messages.deletedAt))),
  ])

  return NextResponse.json({
    connection: {
      id: conn.id,
      status: conn.status,
      accessTokenExpiresAt: conn.accessTokenExpiresAt,
      lastSyncAt: conn.lastSyncAt,
      syncState: conn.syncState,
      hasRefreshToken: Boolean(conn.hasRefreshToken),
      scopes: conn.scopes,
    },
    tokenStatus,
    tokenError,
    apiTest: apiTestResult,
    threadDiagnostics: {
      totalThreads: threadStats?.total ?? 0,
      totalMessages: messageStats?.total ?? 0,
      duplicateThreads: duplicateThreads.length > 0 ? duplicateThreads : 'none',
      emptyThreads: emptyThreads.length > 0 ? emptyThreads : 'none',
    },
    note: 'POST to this endpoint to attempt a sync. Add ?force=true for full resync.',
  })
}

/**
 * POST /api/debug/gmail-sync
 * Attempt Gmail sync with verbose logging
 * Add ?force=true to reset sync state and do a full resync
 */
export async function POST(request: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(request.url)
  const forceFullSync = searchParams.get('force') === 'true'

  console.log(`[debug/gmail-sync] Starting sync for user ${user.id}, force=${forceFullSync}`)

  // If force flag is set, reset the sync state to trigger a full sync
  if (forceFullSync) {
    console.log('[debug/gmail-sync] Resetting sync state for full resync...')
    await db
      .update(oauthConnections)
      .set({
        syncState: {},
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, 'GOOGLE')
        )
      )
    console.log('[debug/gmail-sync] Sync state reset complete')
  }

  try {
    // First check if we can get a valid token
    console.log('[debug/gmail-sync] Checking access token...')
    await getValidAccessToken(user.id)
    console.log('[debug/gmail-sync] Access token obtained successfully')

    // Test a single Gmail API call to verify the API is working
    console.log('[debug/gmail-sync] Testing Gmail API with single message list...')
    const testList = await listMessages(user.id, { maxResults: 1 })
    console.log('[debug/gmail-sync] Gmail API test result:', {
      resultSizeEstimate: testList.resultSizeEstimate,
      hasMessages: (testList.messages?.length ?? 0) > 0,
    })

    // Now try the sync
    console.log('[debug/gmail-sync] Starting syncGmailForUser...')
    const result = await syncGmailForUser(user.id)
    console.log('[debug/gmail-sync] Sync complete:', result)

    return NextResponse.json({
      success: true,
      apiTestPassed: true,
      gmailMessageEstimate: testList.resultSizeEstimate,
      result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[debug/gmail-sync] Sync failed:', message, stack)

    return NextResponse.json({
      success: false,
      error: message,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
    }, { status: 500 })
  }
}
