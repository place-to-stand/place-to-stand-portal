import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'

import { HttpError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import { AVATAR_BUCKET } from './avatar'

// Avatars render at up to 32px, so 64px covers 2x screens.
const AVATAR_TRANSFORM = {
  width: 64,
  quality: 80,
  resize: 'contain',
} as const

// A `?v=` URL names one photo for good, so the browser may keep it.
const VERSIONED_CACHE = 'private, max-age=31536000, immutable'
// Without one the photo can change under the same URL: reuse it for five
// minutes, then keep showing it at once while the browser checks for a new
// one in the background (a cheap 304 when it hasn't changed).
const UNVERSIONED_CACHE = 'private, max-age=300, stale-while-revalidate=2592000'

/**
 * Serve a person's photo from our own URL. Each upload gets a new storage
 * path, so the path is the ETag. The old route redirected to a fresh signed
 * Supabase URL on every request, which the browser saw as a new image each
 * time; that's what made photos load in slowly.
 */
export async function avatarImageResponse(
  request: NextRequest,
  loadPath: () => Promise<string>
): Promise<Response> {
  let path: string

  try {
    path = await loadPath()
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error('Failed to load avatar metadata', error)
    return NextResponse.json(
      { error: 'Unable to load avatar.' },
      { status: 500 }
    )
  }

  const etag = `"${path.replace(/[^\w./-]/g, '')}"`
  const cacheControl = request.nextUrl.searchParams.has('v')
    ? VERSIONED_CACHE
    : UNVERSIONED_CACHE
  const headers = { 'Cache-Control': cacheControl, ETag: etag }

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }

  const bucket = getSupabaseServiceClient().storage.from(AVATAR_BUCKET)
  const resized = await bucket.download(path, { transform: AVATAR_TRANSFORM })
  // Image resizing is off on some Supabase setups (local dev): send the
  // original rather than nothing.
  const { data, error } = resized.data ? resized : await bucket.download(path)

  if (error || !data) {
    console.error('Failed to download avatar', error)
    return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 })
  }

  return new Response(data, {
    headers: {
      ...headers,
      'Content-Type': data.type || 'application/octet-stream',
      'Content-Length': String(data.size),
    },
  })
}
