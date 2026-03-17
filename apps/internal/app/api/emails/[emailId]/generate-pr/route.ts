import { NextResponse } from 'next/server'

/**
 * POST /api/emails/[emailId]/generate-pr
 *
 * PR suggestions are not currently supported.
 * This feature will be redesigned in a future sprint.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'PR suggestions are not currently supported. This feature will be redesigned in a future sprint.' },
    { status: 501 }
  )
}
