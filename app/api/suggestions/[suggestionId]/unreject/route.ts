import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { suggestions } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'

/**
 * POST /api/suggestions/[suggestionId]/unreject
 *
 * Restores a rejected suggestion back to pending status.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  // Get the suggestion
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(
      and(
        eq(suggestions.id, suggestionId),
        isNull(suggestions.deletedAt)
      )
    )
    .limit(1)

  if (!suggestion) {
    return NextResponse.json(
      { error: 'Suggestion not found' },
      { status: 404 }
    )
  }

  if (suggestion.status !== 'REJECTED') {
    return NextResponse.json(
      { error: 'Only rejected suggestions can be restored' },
      { status: 400 }
    )
  }

  // Update the suggestion status back to PENDING
  await db
    .update(suggestions)
    .set({
      status: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(suggestions.id, suggestionId))

  await logActivity({
    actorId: user.id,
    actorRole: 'ADMIN',
    verb: 'TASK_SUGGESTION_RESTORED',
    summary: 'Restored suggestion to pending',
    targetType: 'TASK',
    targetId: suggestionId,
    metadata: {},
  })

  return NextResponse.json({
    success: true,
    suggestionId,
  })
}
