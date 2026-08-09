import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { searchCommandPalette } from '@/lib/queries/command-palette'

// W5: validate before querying. R1: explicit null → 401 before any
// admin assertion (getCurrentUser returns AppUser | null).
const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.' },
      { status: 400 }
    )
  }

  try {
    const data = await searchCommandPalette(user, parsed.data.q)
    return NextResponse.json({ ok: true, data }, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }
    console.error('[command-palette] search failed', error)
    return NextResponse.json(
      { ok: false, error: 'Search failed.' },
      { status: 500 }
    )
  }
}
