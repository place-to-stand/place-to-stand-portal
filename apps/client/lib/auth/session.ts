import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@pts/db/schema'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type AppUser = {
  id: string
  email: string
  full_name: string | null
  role: 'ADMIN' | 'CLIENT'
  avatar_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  onboarding_completed_at: string | null
}
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = getSupabaseServerClient()

  // getClaims() verifies the session JWT's signature and expiry. With the
  // project on asymmetric signing keys (ES256) that happens in-process against
  // a JWKS cached for 10 minutes — no round trip to Supabase Auth per request.
  // With the legacy HS256 secret it falls back to getUser() internally, so
  // behaviour is unchanged until the key is rotated. Either way the only claim
  // trusted here is `sub`; role, disabled and deleted state come from our own
  // users row below, on every request.
  const { data, error } = await supabase.auth.getClaims()

  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase session', error)
  }

  const authUserId = data?.claims.sub
  if (error || !authUserId) {
    return null
  }

  try {
    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
        onboardingCompletedAt: users.onboardingCompletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.id, authUserId),
          isNull(users.deletedAt),
          // Disabled users are rejected on every request, which also ends any
          // session that existed before the account was disabled.
          isNull(users.disabledAt)
        )
      )
      .limit(1)

    if (!profile) {
      return null
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatarUrl ?? null,
      full_name: profile.fullName ?? null,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
      deleted_at: profile.deletedAt ?? null,
      onboarding_completed_at: profile.onboardingCompletedAt ?? null,
    }
  } catch (profileError) {
    console.error('Failed to load current user', profileError)
    return null
  }
})

const requireUser = async () => {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return user
}

/**
 * Require CLIENT role for the client portal.
 * Admins are also allowed (they may want to see the client view).
 */
export const requireClientUser = async () => {
  const user = await requireUser()

  // Both CLIENT and ADMIN roles are allowed in the client portal
  if (user.role !== 'CLIENT' && user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }

  return user
}
