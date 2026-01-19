import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { generateLeadSuggestions } from '@/lib/leads/actions/generate-suggestions'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    await requireRole('ADMIN')

    const { leadId } = await context.params

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
    console.error('Error generating lead suggestions:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
