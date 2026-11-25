import { NextResponse, type NextRequest } from 'next/server'

import { takeFeedbackReport } from '@/lib/feedback/intake'

/**
 * Intake for the feedback widget (`@placetostand/feedback`), on a project's
 * own websites and in our portals. Public: on the proxy allowlist, so every
 * check lives in `takeFeedbackReport` (lib/feedback/intake.ts).
 *
 * The widget posts multipart form data, which a browser sends cross-site
 * without a preflight. Cookies are never allowed cross-site (no
 * Allow-Credentials), and only an allowed website gets an Allow-Origin
 * header, so no other page can read the answer.
 */

// permission: public — the project id is the key; origin, rate limits and spam checks in takeFeedbackReport
export async function POST(request: NextRequest) {
  const result = await takeFeedbackReport(request, request.nextUrl.origin)
  const headers = corsHeaders(result.allowOrigin)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers }
    )
  }

  return NextResponse.json(
    { ok: true, data: { id: result.id } },
    { status: 201, headers }
  )
}

// permission: public — a preflight answers nothing; POST does every check
export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get('origin')),
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Max-Age': '86400',
    },
  })
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' }
}
