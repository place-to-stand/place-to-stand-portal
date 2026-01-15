import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchQuery } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AVATAR_BUCKET, ensureAvatarBucket } from '@/lib/storage/avatar'
import { getUserAvatarPath } from '@/lib/queries/users'
import { HttpError } from '@/lib/errors/http'
import { CONVEX_FLAGS } from '@/lib/feature-flags'

// Convex ID validation (base32-like format)
const convexIdRegex = /^[a-z0-9]+$/

const paramsSchema = z.object({
  userId: z.string().refine(
    (val) => {
      // Accept UUID for Supabase or Convex ID format
      const isUuid = z.string().uuid().safeParse(val).success
      const isConvexId = convexIdRegex.test(val)
      return isUuid || isConvexId
    },
    { message: 'Invalid user ID format' }
  ),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  await requireUser()

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const userId = parsedParams.data.userId

  // Use Convex Storage if enabled
  if (CONVEX_FLAGS.STORAGE) {
    try {
      const { api } = await import('@/convex/_generated/api')
      const avatarUrl = await fetchQuery(
        api.storage.avatars.getAvatarUrl,
        { userId: userId as unknown as import('@/convex/_generated/dataModel').Id<'users'> },
        { token: await convexAuthNextjsToken() }
      )

      if (!avatarUrl) {
        return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 })
      }

      // Redirect to the Convex storage URL
      return NextResponse.redirect(avatarUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      })
    } catch (error) {
      console.error('Failed to get Convex avatar URL', error)
      return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 })
    }
  }

  // Supabase Storage (default)
  const supabase = getSupabaseServiceClient()

  let avatarPath: string

  try {
    avatarPath = await getUserAvatarPath(userId)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load avatar metadata', error)
    return NextResponse.json({ error: 'Unable to load avatar.' }, { status: 500 })
  }

  await ensureAvatarBucket(supabase)

  // Avatar renders at h-8 w-8 (32px), so 2x = 64px width, height auto
  const maxRenderWidth = 32
  const transformWidth = maxRenderWidth * 2 // 64px

  // Generate signed URL with image transform
  // Supabase image transforms work by appending query parameters to the storage URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, 3600, {
      // 1 hour expiry
      transform: {
        quality: 80,
        width: transformWidth,
        resize: 'contain',
      },
    })

  if (signedUrlError || !signedUrlData) {
    console.error('Failed to generate signed URL', signedUrlError)
    return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 })
  }

  // Redirect to the transformed image URL
  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  })
}
