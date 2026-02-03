import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { listThreadsForLead } from '@/lib/queries/threads'

/**
 * GET /api/leads/[leadId]/threads
 *
 * Fetches all email threads linked to a specific lead.
 * Admin-only endpoint.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  await requireRole('ADMIN')
  const { leadId } = await params

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const threads = await listThreadsForLead(leadId, { limit, offset })
    console.log(`[lead-threads/route] Found ${threads.length} threads for leadId: ${leadId}`)
    if (threads.length > 0) {
      console.log(`[lead-threads/route] Sample thread IDs: ${threads.slice(0, 3).map(t => t.id).join(', ')}`)
    }

    return NextResponse.json({ threads })
  } catch (error) {
    console.error('Failed to fetch lead threads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}
