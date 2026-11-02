import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@pts/db/schema'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type AppUser = {
  id: string
  email: string
  full_name: string | null
  role: 'ADMIN' | 'SALES' | 'CLIENT'
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
    if (!(await sessionIsLive(data.claims.session_id, authUserId))) {
      return null
    }
    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: personNameSql,
        // The role in force this month: a scheduled role change counts from
        // its month even before the internal portal's cron writes it to
        // users.role.
        role: sql<
          AppUser['role']
        >`coalesce(user_role_as_of(${users.id}, date_trunc('month', timezone('utc', now()))::date), ${users.role})`,
        avatarUrl: personAvatarSql,
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

/**
 * The token's Supabase session still exists. getClaims() checks only the
 * JWT's signature and expiry, so a token issued before its session was
 * ended (sign-out, or an orphaned sign-in taken over and re-linked to a
 * person) would otherwise keep working until it expires. Ending a session
 * deletes its auth.sessions row; this makes that end the token at once.
 * (Security review, Nov 2026.)
 */
async function sessionIsLive(
  sessionId: unknown,
  userId: string
): Promise<boolean> {
  // Every Supabase user token carries session_id (password, link, invite,
  // refresh): one without it isn't a user session.
  if (typeof sessionId !== 'string' || !sessionId) return false
  try {
    const [row] = await db.execute<{ live: boolean }>(
      sql`select exists (select 1 from auth.sessions s where s.id = ${sessionId}::uuid and s.user_id = ${userId}::uuid) as live`
    )
    return Boolean(row?.live)
  } catch (error) {
    // Fail open on an error (e.g. the database role can't read
    // auth.sessions): the token's signature and expiry are already
    // verified and the users row is still checked, so this falls back to
    // the old behaviour instead of signing everyone out. A session that is
    // gone (the check ran and found no row) still signs them out.
    console.error('Session check failed; allowing the verified token', error)
    return true
  }
}
