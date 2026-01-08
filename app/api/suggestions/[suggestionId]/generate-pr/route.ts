import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions/[suggestionId]/generate-pr
 *
 * PR suggestions are not currently supported.
 * This feature will be redesigned in a future sprint.
 */
export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ suggestionId: string }> }
) {
  return NextResponse.json(
    { error: 'PR suggestions are not currently supported. This feature will be redesigned in a future sprint.' },
    { status: 501 }
  )
}
