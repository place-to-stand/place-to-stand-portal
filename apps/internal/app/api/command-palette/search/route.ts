import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { authorizeRoute } from '@/lib/auth/guard'
import { HttpError } from '@/lib/errors/http'
import { searchCommandPalette } from '@/lib/queries/command-palette'

// Validate before querying.
const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export async function GET(request: NextRequest) {
  const { user, denied } = await authorizeRoute('portal.command_palette')
  if (denied) return denied

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
