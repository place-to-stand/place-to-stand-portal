import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { approveSuggestion, rejectSuggestion } from '@/lib/data/suggestions'

const taskStatusEnum = z.enum(['BACKLOG', 'ON_DECK', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'])

const bulkSchema = z.object({
  action: z.enum(['approve', 'reject']),
  suggestionIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().max(500).optional(), // For rejections
  // Per-suggestion status map: { suggestionId: status }
  statuses: z.record(z.string().uuid(), taskStatusEnum).optional(),
})

export async function POST(request: NextRequest) {
  const user = await requireRole('ADMIN')

  const body = await request.json()
  const parsed = bulkSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { action, suggestionIds, reason, statuses } = parsed.data

  const results: Array<{ id: string; success: boolean; error?: string }> = []

  for (const id of suggestionIds) {
    try {
      if (action === 'approve') {
        // Get per-suggestion status, defaulting to BACKLOG if not specified
        const status = statuses?.[id] ?? 'BACKLOG'
        await approveSuggestion(id, user.id, { status })
      } else {
        await rejectSuggestion(id, user.id, reason)
      }
      results.push({ id, success: true })
    } catch (error) {
      results.push({
        id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  })
}
