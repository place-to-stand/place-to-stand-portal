import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { getSuggestionsForLead } from '@/lib/queries/suggestions'

type RouteContext = { params: Promise<{ leadId: string }> }

const paramsSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
})

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    await requireRole('ADMIN')

    const params = await context.params
    const parsed = paramsSchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid lead ID' },
        { status: 400 }
      )
    }

    const { leadId } = parsed.data
    const includeResolved = request.nextUrl.searchParams.get('includeResolved') === 'true'
    const suggestions = await getSuggestionsForLead(leadId, {
      pendingOnly: !includeResolved,
    })

    return NextResponse.json({ ok: true, suggestions })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }
    console.error('Error fetching lead suggestions:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}
