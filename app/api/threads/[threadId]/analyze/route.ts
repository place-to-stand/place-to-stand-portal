import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { analyzeMessagesForThread } from '@/lib/ai/suggestion-service'

/**
 * POST /api/threads/[threadId]/analyze
 *
 * Triggers AI analysis of unanalyzed messages in a thread.
 * Only processes if thread has both client and project linked.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { threadId } = await params

  try {
    const result = await analyzeMessagesForThread(threadId, user.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Thread analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
