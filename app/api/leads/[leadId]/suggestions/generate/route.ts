import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { generateLeadSuggestions } from '@/lib/leads/actions/generate-suggestions'

type RouteContext = { params: Promise<{ leadId: string }> }

const paramsSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
})

export async function POST(
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
    const result = await generateLeadSuggestions(leadId)

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      suggestionsCount: result.suggestionsCount,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }
    console.error('Error generating lead suggestions:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
